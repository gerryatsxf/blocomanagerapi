import { StorageProvider } from '../enums/storage-provider.enum';
import * as path from 'path';
import * as fs from 'fs';

export interface IStorageService {
  uploadFile(file: Express.Multer.File, tenantId: string, imageType: string): Promise<string>;
  deleteFile(filename: string): Promise<void>;
  getFileUrl(filename: string): string;
}

export class LocalStorageService implements IStorageService {
  private readonly basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), 'public', 'tenant', 'assets');
    // Ensure directory exists
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, tenantId: string, imageType: string): Promise<string> {
    const ext = path.extname(file.originalname);
    const filename = `${tenantId}_${imageType}${ext}`;
    const filePath = path.join(this.basePath, filename);

    // Move file to destination
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
}

// Placeholder for future AWS S3 implementation
export class S3StorageService implements IStorageService {
  constructor(config: any) {
    // TODO: Initialize AWS S3 client
  }

  async uploadFile(file: Express.Multer.File, tenantId: string, imageType: string): Promise<string> {
    // TODO: Implement S3 upload
    throw new Error('S3 storage not yet implemented');
  }

  async deleteFile(filename: string): Promise<void> {
    // TODO: Implement S3 delete
    throw new Error('S3 storage not yet implemented');
  }

  getFileUrl(filename: string): string {
    // TODO: Return S3 URL
    throw new Error('S3 storage not yet implemented');
  }
}

// Placeholder for future Azure Blob implementation
export class AzureBlobStorageService implements IStorageService {
  constructor(config: any) {
    // TODO: Initialize Azure Blob client
  }

  async uploadFile(file: Express.Multer.File, tenantId: string, imageType: string): Promise<string> {
    // TODO: Implement Azure Blob upload
    throw new Error('Azure Blob storage not yet implemented');
  }

  async deleteFile(filename: string): Promise<void> {
    // TODO: Implement Azure Blob delete
    throw new Error('Azure Blob storage not yet implemented');
  }

  getFileUrl(filename: string): string {
    // TODO: Return Azure Blob URL
    throw new Error('Azure Blob storage not yet implemented');
  }
}

// Placeholder for future Google Cloud Storage implementation
export class GoogleCloudStorageService implements IStorageService {
  constructor(config: any) {
    // TODO: Initialize Google Cloud Storage client
  }

  async uploadFile(file: Express.Multer.File, tenantId: string, imageType: string): Promise<string> {
    // TODO: Implement Google Cloud Storage upload
    throw new Error('Google Cloud Storage not yet implemented');
  }

  async deleteFile(filename: string): Promise<void> {
    // TODO: Implement Google Cloud Storage delete
    throw new Error('Google Cloud Storage not yet implemented');
  }

  getFileUrl(filename: string): string {
    // TODO: Return Google Cloud Storage URL
    throw new Error('Google Cloud Storage not yet implemented');
  }
}

// Factory to create storage service based on provider
export class StorageServiceFactory {
  static createStorageService(provider: StorageProvider, config?: any): IStorageService {
    switch (provider) {
      case StorageProvider.LOCAL:
        return new LocalStorageService(config?.basePath);
      case StorageProvider.AWS_S3:
        return new S3StorageService(config);
      case StorageProvider.AZURE_BLOB:
        return new AzureBlobStorageService(config);
      case StorageProvider.GOOGLE_CLOUD:
        return new GoogleCloudStorageService(config);
      default:
        return new LocalStorageService();
    }
  }
}
