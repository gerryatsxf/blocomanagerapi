import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageConfig, StorageConfigSchema } from './schemas/storage-config.schema';
import { StorageConfigService } from './storage-config.service';
import { StorageConfigController } from './storage-config.controller';
import { EncryptionModule } from '../encryption/encryption.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StorageConfig.name, schema: StorageConfigSchema },
    ]),
    EncryptionModule,
    UsersModule, // Required by PlatformOwnerGuard
  ],
  controllers: [StorageConfigController],
  providers: [StorageConfigService],
  exports: [StorageConfigService],
})
export class StorageConfigModule {}
