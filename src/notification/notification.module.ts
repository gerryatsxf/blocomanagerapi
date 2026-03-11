import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [forwardRef(() => TenantModule)],
  controllers: [],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
