import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NylasModule } from '../nylas/nylas.module';

@Module({
  imports: [NylasModule],
  controllers: [],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
