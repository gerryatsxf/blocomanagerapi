import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetSchema } from './entities/password-reset.schema';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'PasswordReset', schema: PasswordResetSchema },
    ]),
    EncryptionModule,
  ],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
