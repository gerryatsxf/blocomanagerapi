import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantGuard } from './guards';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleOAuthController } from './google-oauth.controller';
import { NylasModule } from '../nylas/nylas.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [NylasModule, CalendarModule],
  controllers: [GoogleOAuthController],
  providers: [TenantService, TenantGuard, GoogleOAuthService],
  exports: [TenantService, TenantGuard, GoogleOAuthService],
})
export class TenantModule {}