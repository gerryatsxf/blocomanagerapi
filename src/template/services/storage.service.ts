import { StorageProviderType } from '../../storage-config/schemas/storage-config.schema';
import * as path from 'path';
import * as fs from 'fs';

export interface IStorageService {
  uploadFile(file: Express.Multer.File, tenantId: string, imageType: string): Promise<string>;
  deleteFile(filename: string): Promise<void>;
  getFileUrl(filename: string): string;
  listFiles(tenantId: string): Promise<string[]>;
}

export class LocalStorageService implements IStorageService {
  private readonly basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), 'public', 'tenant', 'assets');
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, tenantId: string, imageType: string): Promise<string> {
    const ext = path.extname(file.originalname);
    const filename = `${tenantId}_${imageType}${ext}`;
    const filePath = path.join(this.basePath, filename);
    fs.writeFileSync(filePath, file.buffer || fs.readFileSync(file.path));
    return filename;
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(this.basePath, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getFileUrl(filename: string): string {
    return `/tenant/assets/${filename}`;
  }

  async listFiles(tenantId: string): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.basePath);
      return files.filter((f) => f.startsWith(`${tenantId}_`));
    } catch {
      return [];
    }
  }
}

/**
 * S3-compatible storage — works for both AWS S3 and DigitalOcean Spaces.
 * SDK not installed yet — stub that throws descriptive errors.
 */
export class S3CompatibleStorageService implements IStorageService {
  private readonly providerLabel: string;

  constructor(
    private readonly config: Record<string, any>,
    providerLabel: string = 'S3-Compatible',
  ) {
    this.providerLabel = providerLabel;
  }

  async uploadFile(): Promise<string> {
    throw new Error(`${this.providerLabel} upload not implemented — install @aws-sdk/client-s3 and configure credentials in Admin → Storage`);
  }
  async deleteFile(): Promise<void> {
    throw new Error(`${this.providerLabel} delete not implemented`);
  }
  getFileUrl(filename: string): string {
    if (this.config.endpoint && this.config.bucket) {
      return `${this.config.endpoint}/${this.config.bucket}/${filename}`;
    }
    if (this.config.bucket && this.config.region) {
      return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${filename}`;
    }
    throw new Error(`${this.providerLabel} getFileUrl not configured`);
  }
  async listFiles(): Promise<string[]> {
    throw new Error(`${this.providerLabel} listFiles not implemented`);
  }
}

export class AzureBlobStorageService implements IStorageService {
  constructor(private readonly config: Record<string, any>) {}

  async uploadFile(): Promise<string> {
    throw new Error('Azure Blob upload not implemented — install @azure/storage-blob and configure credentials in Admin → Storage');
  }
  async deleteFile(): Promise<void> {
    throw new Error('Azure Blob delete not implemented');
  }
  getFileUrl(filename: string): string {
    if (this.config.containerName) {
      return `https://${this.config.containerName}.blob.core.windows.net/${filename}`;
    }
    throw new Error('Azure Blob getFileUrl not configured');
  }
  async listFiles(): Promise<string[]> {
    throw new Error('Azure Blob listFiles not implemented');
  }
}

export class GoogleCloudStorageService implements IStorageService {
  constructor(private readonly config: Record<string, any>) {}

  async uploadFile(): Promise<string> {
    throw new Error('Google Cloud Storage upload not implemented — install @google-cloud/storage and configure credentials in Admin → Storage');
  }
  async deleteFile(): Promise<void> {
    throw new Error('Google Cloud Storage delete not implemented');
  }
  getFileUrl(filename: string): string {
    if (this.config.bucketName) {
      return `https://storage.googleapis.com/${this.config.bucketName}/${filename}`;
    }
    throw new Error('Google Cloud Storage getFileUrl not configured');
  }
  async listFiles(): Promise<string[]> {
    throw new Error('Google Cloud Storage listFiles not implemented');
  }
}

/**
 * Factory to create the correct storage service instance from a provider + config.
 */
export class StorageServiceFactory {
  static create(provider: StorageProviderType, config: Record<string, any> = {}): IStorageService {
    switch (provider) {
      case StorageProviderType.LOCAL:
        return new LocalStorageService(config.basePath);
      case StorageProviderType.AWS_S3:
        return new S3CompatibleStorageService(config, 'Amazon S3');
      case StorageProviderType.DO_SPACES:
        return new S3CompatibleStorageService(config, 'DigitalOcean Spaces');
      case StorageProviderType.AZURE_BLOB:
        return new AzureBlobStorageService(config);
      case StorageProviderType.GOOGLE_CLOUD:
        return new GoogleCloudStorageService(config);
      default:
        return new LocalStorageService();
    }
  }
}
