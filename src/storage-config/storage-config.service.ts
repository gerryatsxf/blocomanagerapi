import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StorageConfig, StorageConfigDocument, StorageProviderType } from './schemas/storage-config.schema';
import { CreateStorageConfigDto, UpdateStorageConfigDto } from './dto/storage-config.dto';
import { EncryptionService } from '../encryption/encryption.service';

/** Fields that contain sensitive credentials — always encrypted at rest */
const CREDENTIAL_FIELDS = [
  'accessKeyId',
  'secretAccessKey',
  'connectionString',
  'serviceAccountKey',
] as const;

@Injectable()
export class StorageConfigService {
  private readonly logger = new Logger(StorageConfigService.name);

  constructor(
    @InjectModel(StorageConfig.name)
    private readonly model: Model<StorageConfigDocument>,
    private readonly encryptionService: EncryptionService,
  ) {}

  // ── CRUD ──

  async create(dto: CreateStorageConfigDto): Promise<StorageConfig> {
    const encrypted = this.encryptCredentials(dto);

    // If this is marked as default, unset any existing default
    if (encrypted.isDefault) {
      await this.model.updateMany({}, { isDefault: false });
    }

    const doc = await this.model.create(encrypted);
    this.logger.log(`Storage config created: "${doc.name}" (${doc.provider})`);
    return this.sanitize(doc.toObject());
  }

  async findAll(): Promise<StorageConfig[]> {
    const docs = await this.model.find().sort({ createdAt: -1 }).lean();
    return docs.map((d) => this.sanitize(d));
  }

  async findById(id: string): Promise<StorageConfig> {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException(`Storage config ${id} not found`);
    return this.sanitize(doc);
  }

  async update(id: string, dto: UpdateStorageConfigDto): Promise<StorageConfig> {
    const existing = await this.model.findById(id);
    if (!existing) throw new NotFoundException(`Storage config ${id} not found`);

    const encrypted = this.encryptCredentials(dto);

    // If marking as default, unset others
    if (encrypted.isDefault) {
      await this.model.updateMany({ _id: { $ne: id } }, { isDefault: false });
    }

    const updated = await this.model
      .findByIdAndUpdate(id, encrypted, { new: true })
      .lean();
    this.logger.log(`Storage config updated: "${updated.name}" (${updated.provider})`);
    return this.sanitize(updated);
  }

  async remove(id: string): Promise<void> {
    const result = await this.model.findByIdAndDelete(id);
    if (!result) throw new NotFoundException(`Storage config ${id} not found`);
    this.logger.log(`Storage config deleted: "${result.name}"`);
  }

  // ── Lookup for other services ──

  /**
   * Get the storage config for a given tenant.
   * Priority: tenant-assigned config → default config → local fallback.
   */
  async getConfigForTenant(tenantId: string): Promise<{ provider: StorageProviderType; config: Record<string, any> }> {
    // 1. Find a config that has this tenant assigned
    let doc = await this.model.findOne({ tenants: tenantId }).lean();

    // 2. Fall back to default
    if (!doc) {
      doc = await this.model.findOne({ isDefault: true }).lean();
    }

    // 3. Fall back to local
    if (!doc) {
      return { provider: StorageProviderType.LOCAL, config: {} };
    }

    return {
      provider: doc.provider as StorageProviderType,
      config: this.decryptCredentials(doc),
    };
  }

  // ── Encryption helpers ──

  private encryptCredentials(dto: Record<string, any>): Record<string, any> {
    const result = { ...dto };
    for (const field of CREDENTIAL_FIELDS) {
      if (result[field] && typeof result[field] === 'string' && result[field].trim()) {
        // Don't re-encrypt if the value is already masked (no change from frontend)
        if (result[field] === '••••••••') {
          delete result[field]; // Don't overwrite with mask
        } else {
          result[field] = this.encryptionService.encrypt(result[field]);
        }
      }
    }
    return result;
  }

  private decryptCredentials(doc: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    const keys = ['bucket', 'region', 'endpoint', 'containerName', 'projectId', 'bucketName', 'basePath'];

    for (const key of keys) {
      if (doc[key]) result[key] = doc[key];
    }

    for (const field of CREDENTIAL_FIELDS) {
      if (doc[field]) {
        try {
          result[field] = this.encryptionService.decrypt(doc[field]);
        } catch {
          this.logger.warn(`Failed to decrypt ${field} for config ${doc._id}`);
          result[field] = '';
        }
      }
    }

    return result;
  }

  /**
   * Returns sanitized storage config — credentials masked with ••••••••
   * Safe to send to the frontend.
   */
  private sanitize(doc: Record<string, any>): any {
    const result = { ...doc };
    for (const field of CREDENTIAL_FIELDS) {
      if (result[field]) {
        result[field] = '••••••••';
      }
    }
    return result;
  }
}
