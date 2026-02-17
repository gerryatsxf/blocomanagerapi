import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { NotificationModule } from 'src/notification/notification.module';
import { BookingModule } from '../booking/booking.module';
import { BookingService } from '../booking/booking.service';
import { FreeSlotModule } from '../free-slot/free-slot.module';
import { FreeSlotService } from '../free-slot/free-slot.service';
import { SessionModule } from '../session/session.module';
import { SessionService } from '../session/session.service';
import { EncryptionModule } from '../encryption/encryption.module';
import { EncryptionService } from '../encryption/encryption.service';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionSchema } from '../session/entities/session.schema';
import { BookingSchema } from '../booking/entities/booking.schema';
import { AvailabilityModule } from '../availability/availability.module';
import { AvailabilityService } from '../availability/availability.service';
import { CalendarModule } from '../calendar/calendar.module';
import { MeetingModule } from '../meeting/meeting.module';
import { MeetingService } from '../meeting/meeting.service';
import { NylasModule } from '../nylas/nylas.module';
import { NylasService } from '../nylas/nylas.service';
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
    NylasModule,
    TenantModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    BookingService,
    FreeSlotService,
    SessionService,
    EncryptionService,
    AvailabilityService,
    NylasService,
  ],
})
export class PaymentModule {}
