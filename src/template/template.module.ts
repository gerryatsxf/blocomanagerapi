import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { Template, TemplateSchema } from './entities/template.entity';
import { UsersModule } from '../users/users.module';
import { StorageConfigModule } from '../storage-config/storage-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Template.name, schema: TemplateSchema },
    ]),
    UsersModule,
    StorageConfigModule,
  ],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
