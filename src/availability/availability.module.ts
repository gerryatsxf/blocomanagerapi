import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AvailabilityService } from './availability.service';
import { TenantAvailability, TenantAvailabilitySchema } from './schemas/tenant-availability.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TenantAvailability.name, schema: TenantAvailabilitySchema },
    ]),
  ],
  controllers: [],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
