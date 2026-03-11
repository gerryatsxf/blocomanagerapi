import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { NotificationModule } from 'src/notification/notification.module';
import { BookingModule } from '../booking/booking.module';
import { FreeSlotModule } from '../free-slot/free-slot.module';
import { SessionModule } from '../session/session.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionSchema } from '../session/entities/session.schema';
import { BookingSchema } from '../booking/entities/booking.schema';
import { AvailabilityModule } from '../availability/availability.module';
import { CalendarModule } from '../calendar/calendar.module';
import { MeetingModule } from '../meeting/meeting.module';
import { TenantModule } from '../tenant/tenant.module';
@Module({
  imports: [
    NotificationModule,
    BookingModule,
    FreeSlotModule,
    SessionModule,
    EncryptionModule,
    MongooseModule.forFeature([{ name: 'Session', schema: SessionSchema }]),
    MongooseModule.forFeature([{ name: 'Booking', schema: BookingSchema }]),
    AvailabilityModule,
    CalendarModule,
    MeetingModule,
    TenantModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
  ],
})
export class PaymentModule {}
