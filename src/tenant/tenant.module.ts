import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantGuard } from './guards';

@Module({
  providers: [TenantService, TenantGuard],
  exports: [TenantService, TenantGuard],
})
export class TenantModule {}