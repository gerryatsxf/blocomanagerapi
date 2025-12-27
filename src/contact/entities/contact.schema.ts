import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum ContactStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum ContactPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Schema({ timestamps: true })
export class Contact extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ 
    required: true, 
    enum: ContactPriority,
    default: ContactPriority.MEDIUM 
  })
  priority: ContactPriority;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, unique: true })
  referenceId: string;

  @Prop({ 
    enum: ContactStatus,
    default: ContactStatus.NEW 
  })
  status: ContactStatus;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

// Index for quick lookups
ContactSchema.index({ referenceId: 1 });
ContactSchema.index({ email: 1 });
ContactSchema.index({ status: 1 });
ContactSchema.index({ priority: 1 });
