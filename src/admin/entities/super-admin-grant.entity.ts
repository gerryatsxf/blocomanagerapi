import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SuperAdminGrant extends Document {
  @Prop({ required: true, length: 6 })
  code: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  used: boolean;

  @Prop()
  usedAt?: Date;

  @Prop()
  grantedToEmail?: string;

  @Prop()
  ipAddress?: string;
}

export const SuperAdminGrantSchema = SchemaFactory.createForClass(SuperAdminGrant);

// Index for automatic cleanup of expired codes
SuperAdminGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
