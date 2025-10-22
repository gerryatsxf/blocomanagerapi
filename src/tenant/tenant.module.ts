import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantGuard } from './guards';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleOAuthController } from './google-oauth.controller';
import { GoogleCalendarService } from './google-calendar.service';
// NOTE: NylasModule and CalendarModule kept available for future use but not imported here

@Module({
  imports: [], // Removed Nylas and Calendar modules - using Google Calendar API directly
  controllers: [GoogleOAuthController],
  providers: [TenantService, TenantGuard, GoogleOAuthService, GoogleCalendarService],
  exports: [TenantService, TenantGuard, GoogleOAuthService, GoogleCalendarService],
})
export class TenantModule {}