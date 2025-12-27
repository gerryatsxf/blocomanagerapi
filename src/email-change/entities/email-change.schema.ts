import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum EmailChangeStep {
  VERIFY_CURRENT = 'VERIFY_CURRENT',
  VERIFY_NEW = 'VERIFY_NEW',
  COMPLETED = 'COMPLETED',
}

@Schema({ timestamps: true })
export class EmailChange extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  currentEmail: string;

  @Prop({ required: false })
  newEmail?: string;

  @Prop({ required: true })
  currentEmailToken: string;

  @Prop({ required: false })
  newEmailToken?: string;

  @Prop({ 
    required: true, 
    enum: EmailChangeStep,
    default: EmailChangeStep.VERIFY_CURRENT 
  })
  step: EmailChangeStep;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const EmailChangeSchema = SchemaFactory.createForClass(EmailChange);

// TTL index to automatically delete expired tokens
EmailChangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
