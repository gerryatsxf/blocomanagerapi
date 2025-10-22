import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantGuard } from './guards';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleOAuthController } from './google-oauth.controller';

@Module({
  imports: [],
  controllers: [GoogleOAuthController],
  providers: [TenantService, TenantGuard, GoogleOAuthService],
  exports: [TenantService, TenantGuard, GoogleOAuthService],
})
export class TenantModule {}