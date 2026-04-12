import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StorageConfigDocument = StorageConfig & Document;

export enum StorageProviderType {
  LOCAL = 'local',
  AWS_S3 = 'aws_s3',
  DO_SPACES = 'do_spaces',
  AZURE_BLOB = 'azure_blob',
  GOOGLE_CLOUD = 'google_cloud',
}

/** Human-readable labels for the Super Admin UI */
export const StorageProviderLabels: Record<StorageProviderType, string> = {
  [StorageProviderType.LOCAL]: 'Local Filesystem',
  [StorageProviderType.AWS_S3]: 'Amazon S3',
  [StorageProviderType.DO_SPACES]: 'DigitalOcean Spaces',
  [StorageProviderType.AZURE_BLOB]: 'Azure Blob Storage',
  [StorageProviderType.GOOGLE_CLOUD]: 'Google Cloud Storage',
};

@Schema({ timestamps: true })
export class StorageConfig {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: StorageProviderType })
  provider: StorageProviderType;

  // ── S3-compatible fields (AWS S3 + DigitalOcean Spaces) ──
  @Prop()
  bucket?: string;

  @Prop()
  region?: string;

  @Prop()
  endpoint?: string; // Custom endpoint for DO Spaces or S3-compatible

  @Prop()
  accessKeyId?: string; // Encrypted at rest

  @Prop()
  secretAccessKey?: string; // Encrypted at rest

  // ── Azure Blob fields ──
  @Prop()
  connectionString?: string; // Encrypted at rest

  @Prop()
  containerName?: string;

  // ── Google Cloud Storage fields ──
  @Prop()
  projectId?: string;

  @Prop()
  bucketName?: string;

  @Prop()
  serviceAccountKey?: string; // Encrypted at rest (JSON string)

  // ── Local filesystem fields ──
  @Prop()
  basePath?: string;

  // ── Assignment ──
  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ type: [String], default: [] })
  tenants: string[]; // tenantIds assigned to this storage config

  createdAt?: Date;
  updatedAt?: Date;
}

export const StorageConfigSchema = SchemaFactory.createForClass(StorageConfig);
