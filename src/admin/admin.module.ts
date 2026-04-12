import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, UserSchema } from '../users/entities/user.entity';
import { SuperAdminGrant, SuperAdminGrantSchema } from './entities/super-admin-grant.entity';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { NotificationModule } from '../notification/notification.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { ProductModule } from '../product/product.module';
import { TenantModule } from '../tenant/tenant.module';
import { AdminMeetingController } from './admin-meeting.controller';
import { AdminBookingController } from './admin-booking.controller';
import { AdminContactController } from './admin-contact.controller';
import { AdminAvailabilityController } from './admin-availability.controller';
import { MeetingModule } from '../meeting/meeting.module';
import { CalendarModule } from '../calendar/calendar.module';
import { BookingModule } from '../booking/booking.module';
import { AvailabilityModule } from '../availability/availability.module';
import { CRMContactSchema } from './schemas/contact.schema';
import { Tenant, TenantSchema } from '../tenant/schemas/tenant.schema';
import { Subscription, SubscriptionSchema } from '../subscription/schemas/subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: SuperAdminGrant.name, schema: SuperAdminGrantSchema },
      { name: 'CRMContact', schema: CRMContactSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    UsersModule,
    SessionModule,
    NotificationModule,
    EncryptionModule,
    ProductModule,
    TenantModule,
    MeetingModule,
    CalendarModule,
    BookingModule,
    AvailabilityModule,
  ],
  controllers: [AdminController, AdminMeetingController, AdminBookingController, AdminContactController, AdminAvailabilityController],
  providers: [AdminService, SuperAdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
