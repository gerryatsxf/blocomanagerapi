import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PlatformOwnerGrant extends Document {
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

export const PlatformOwnerGrantSchema = SchemaFactory.createForClass(PlatformOwnerGrant);

// Index for automatic cleanup of expired codes
PlatformOwnerGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
