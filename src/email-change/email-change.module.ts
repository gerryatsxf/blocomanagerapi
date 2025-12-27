import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailChangeService } from './email-change.service';
import { EmailChange, EmailChangeSchema } from './entities/email-change.schema';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailChange.name, schema: EmailChangeSchema },
    ]),
    EncryptionModule,
  ],
  providers: [EmailChangeService],
  exports: [EmailChangeService],
})
export class EmailChangeModule {}
