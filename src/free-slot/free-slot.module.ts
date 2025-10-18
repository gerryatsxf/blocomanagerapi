import { Module } from '@nestjs/common';
import { FreeSlotService } from './free-slot.service';
import { FreeSlotController } from './free-slot.controller';
import { AvailabilityService } from '../availability/availability.service';
import { SessionModule } from '../session/session.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [SessionModule, CalendarModule],
  controllers: [FreeSlotController],
  providers: [FreeSlotService, AvailabilityService],
})
export class FreeSlotModule {}
