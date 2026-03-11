import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TenantAvailabilityDocument = TenantAvailability & Document;

@Schema({ timestamps: true })
export class AvailableHourRange {
  @Prop({ required: true })
  startTime: string; // e.g. '09:00'

  @Prop({ required: true })
  endTime: string; // e.g. '17:00'
}

@Schema({ timestamps: true })
export class TenantAvailability {
  @Prop({ required: true, unique: true, index: true })
  tenantId: string;

  @Prop({ required: true, default: 'America/Monterrey' })
  timezone: string;

  @Prop({ required: true, default: 30 })
  sessionDuration: number; // 30, 45, 60, or 90 minutes

  @Prop({ type: [String], default: [] })
  availableDays: string[]; // e.g. ['monday', 'tuesday', ...]

  @Prop({ type: [{ startTime: String, endTime: String }], default: [] })
  availableHours: AvailableHourRange[]; // e.g. [{ startTime: '09:00', endTime: '12:00' }]
}

export const TenantAvailabilitySchema = SchemaFactory.createForClass(TenantAvailability);
