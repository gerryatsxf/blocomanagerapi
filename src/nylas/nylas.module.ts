import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NylasService } from './nylas.service';

@Module({
  imports: [ConfigModule],
  providers: [NylasService],
  exports: [NylasService],
})
export class NylasModule {}