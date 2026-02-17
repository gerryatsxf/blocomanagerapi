import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { HttpModule } from '@nestjs/axios';
import { FreeSlotService } from '../free-slot/free-slot.service';
import { FreeSlotModule } from '../free-slot/free-slot.module';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingSchema } from '../booking/entities/booking.schema';
import { AvailabilityService } from '../availability/availability.service';
import { AvailabilityModule } from '../availability/availability.module';
import { CalendarModule } from '../calendar/calendar.module';
import { BookingController } from './booking.controller';
import { SessionModule } from '../session/session.module';
import { SessionService } from '../session/session.service';
import { SessionSchema } from '../session/entities/session.schema';
import { EncryptionModule } from '../encryption/encryption.module';
import { EncryptionService } from '../encryption/encryption.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    HttpModule,
    FreeSlotModule,
    AvailabilityModule,
    EncryptionModule,
    CalendarModule,
    SessionModule,
    TenantModule,
    MongooseModule.forFeature([{ name: 'Session', schema: SessionSchema }]),
    MongooseModule.forFeature([{ name: 'Booking', schema: BookingSchema }]),
  ],
  exports: [
    HttpModule,
    MongooseModule, // Export MongooseModule so BookingModel is available in other modules
  ],
  controllers: [BookingController],
  providers: [
    BookingService,
    FreeSlotService,
    AvailabilityService,
    SessionService,
    EncryptionService,
  ],
})
export class BookingModule {}
