import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantService } from './tenant.service';
import { TenantGuard } from './guards';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleOAuthController } from './google-oauth.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleOAuthToken, GoogleOAuthTokenSchema } from './entities/google-oauth-token.entity';
import { ProvisioningService } from './provisioning.service';
import { TenantPublicController } from './tenant-public.controller';
import { ProductModule } from '../product/product.module';
import { CalendarModule } from '../calendar/calendar.module';
import { User, UserSchema } from '../users/entities/user.entity';
import { Tenant, TenantSchema } from './schemas/tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GoogleOAuthToken.name, schema: GoogleOAuthTokenSchema },
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
    ProductModule,
    forwardRef(() => CalendarModule),
  ],
  controllers: [GoogleOAuthController, TenantPublicController],
  providers: [TenantService, TenantGuard, GoogleOAuthService, GoogleCalendarService, ProvisioningService],
  exports: [TenantService, TenantGuard, GoogleOAuthService, GoogleCalendarService, ProvisioningService],
})
export class TenantModule {}