import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

export enum SubscriptionPlan {
  FREE_TRIAL = 'free_trial',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  INCOMPLETE = 'incomplete',
}

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  stripeCustomerId: string;

  @Prop({ index: true })
  stripeSubscriptionId?: string;

  @Prop()
  stripePriceId?: string;

  @Prop({ type: String, enum: SubscriptionPlan, default: SubscriptionPlan.FREE_TRIAL })
  plan: SubscriptionPlan;

  @Prop({ type: String, enum: SubscriptionStatus, default: SubscriptionStatus.TRIALING })
  status: SubscriptionStatus;

  @Prop()
  trialStart?: Date;

  @Prop()
  trialEnd?: Date;

  @Prop()
  currentPeriodStart?: Date;

  @Prop()
  currentPeriodEnd?: Date;

  @Prop({ default: false })
  cancelAtPeriodEnd: boolean;

  @Prop()
  canceledAt?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
