import { Module, forwardRef } from '@nestjs/common';
import { FreeSlotService } from './free-slot.service';
import { FreeSlotController } from './free-slot.controller';
import { AvailabilityService } from '../availability/availability.service';
import { SessionModule } from '../session/session.module';
import { NylasModule } from '../nylas/nylas.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [SessionModule, NylasModule, forwardRef(() => CalendarModule)],
  controllers: [FreeSlotController],
  providers: [FreeSlotService, AvailabilityService],
  exports: [FreeSlotService],
})
export class FreeSlotModule {}
