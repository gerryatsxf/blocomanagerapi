import { Module, forwardRef } from '@nestjs/common';
import { MeetingService } from './meeting.service';
import { HttpModule } from '@nestjs/axios';
import { FreeSlotService } from '../free-slot/free-slot.service';
import { FreeSlotModule } from '../free-slot/free-slot.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AvailabilityService } from '../availability/availability.service';
import { AvailabilityModule } from '../availability/availability.module';
import { CalendarModule } from '../calendar/calendar.module';
import { MeetingController } from './meeting.controller';
import { SessionModule } from '../session/session.module';
import { SessionService } from '../session/session.service';
import { SessionSchema } from '../session/entities/session.schema';
import { EncryptionModule } from '../encryption/encryption.module';
import { EncryptionService } from '../encryption/encryption.service';
import { TenantModule } from '../tenant/tenant.module';
import { Meeting, MeetingSchema } from './entities/meeting.entity';
import { CalendarProviderFactory } from '../calendar/services/calendar-provider.factory';
import { VideoCallService } from './services/video-call.service';

@Module({
  imports: [
    HttpModule,
    FreeSlotModule,
    AvailabilityModule,
    EncryptionModule,
    forwardRef(() => CalendarModule),
    SessionModule,
    forwardRef(() => TenantModule),
    MongooseModule.forFeature([{ name: 'Session', schema: SessionSchema }]),
    MongooseModule.forFeature([{ name: Meeting.name, schema: MeetingSchema }]),
  ],
  exports: [HttpModule, MeetingService, VideoCallService],
  controllers: [MeetingController],
  providers: [
    MeetingService,
    VideoCallService,
    FreeSlotService,
    AvailabilityService,
    SessionService,
    EncryptionService,
    CalendarProviderFactory,
  ],
})
export class MeetingModule {}
