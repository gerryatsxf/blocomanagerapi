import { StorageProvider } from '../enums/storage-provider.enum';

export interface StorageConfig {
  provider: StorageProvider;
  config?: {
    // Local storage config
    basePath?: string;

    // AWS S3 config
    bucket?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;

    // Azure Blob config
    connectionString?: string;
    containerName?: string;

    // Google Cloud config
    projectId?: string;
    keyFilename?: string;
    bucketName?: string;
  };
}
