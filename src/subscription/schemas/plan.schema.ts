import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlanDocument = Plan & Document;

@Schema({ timestamps: true })
export class Plan {
  @Prop({ required: true })
  name: string; // e.g. "Starter", "Pro", "Enterprise"

  @Prop({ required: true, unique: true })
  slug: string; // e.g. "starter", "pro", "enterprise"

  @Prop({ required: true })
  stripePriceId: string; // price_xxx from Stripe

  @Prop({ required: true })
  price: number; // Display price in cents (e.g. 1900 = $19)

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ default: 'month' })
  interval: string; // "month" | "year"

  @Prop({ type: [String], default: [] })
  features: string[]; // ["Up to 100 contacts", "Calendar sync", ...]

  @Prop({ default: 14 })
  trialDays: number; // Free-trial length (0 = no trial)

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isDefault: boolean; // The plan used for free trial onboarding

  @Prop({ default: 0 })
  sortOrder: number;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
