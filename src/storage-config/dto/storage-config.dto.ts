import { IsString, IsEnum, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StorageProviderType } from '../schemas/storage-config.schema';

export class CreateStorageConfigDto {
  @ApiProperty({ description: 'Display name for this storage configuration' })
  @IsString()
  name: string;

  @ApiProperty({ enum: StorageProviderType, description: 'Storage provider type' })
  @IsEnum(StorageProviderType)
  provider: StorageProviderType;

  // S3-compatible fields
  @ApiPropertyOptional() @IsOptional() @IsString() bucket?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endpoint?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accessKeyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() secretAccessKey?: string;

  // Azure Blob fields
  @ApiPropertyOptional() @IsOptional() @IsString() connectionString?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() containerName?: string;

  // Google Cloud fields
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bucketName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceAccountKey?: string;

  // Local fields
  @ApiPropertyOptional() @IsOptional() @IsString() basePath?: string;

  // Assignment
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() tenants?: string[];
}

export class UpdateStorageConfigDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: StorageProviderType }) @IsOptional() @IsEnum(StorageProviderType) provider?: StorageProviderType;

  @ApiPropertyOptional() @IsOptional() @IsString() bucket?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() region?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endpoint?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accessKeyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() secretAccessKey?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() connectionString?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() containerName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bucketName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serviceAccountKey?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() basePath?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() tenants?: string[];
}
