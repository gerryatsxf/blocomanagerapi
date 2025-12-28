import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum PlanId {
  FREE = 'free',
}

export interface PlanFeatures {
  clientManagement: boolean;
  manualAppointments: boolean;
  googleCalendarSync: boolean;
}

@Schema({ timestamps: true })
export class SubscriptionPlan extends Document {
  @Prop({ required: true, unique: true, enum: PlanId })
  planId: PlanId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Object, required: true })
  features: PlanFeatures;
}

export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);

SubscriptionPlanSchema.index({ planId: 1 }, { unique: true });
