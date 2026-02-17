import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NylasModule } from '../nylas/nylas.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [NylasModule, forwardRef(() => TenantModule)],
  controllers: [],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
