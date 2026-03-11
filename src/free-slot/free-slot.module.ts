import { Module, forwardRef } from '@nestjs/common';
import { FreeSlotService } from './free-slot.service';
import { FreeSlotController } from './free-slot.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { SessionModule } from '../session/session.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [SessionModule, forwardRef(() => TenantModule), AvailabilityModule],
  controllers: [FreeSlotController],
  providers: [FreeSlotService],
  exports: [FreeSlotService],
})
export class FreeSlotModule {}
