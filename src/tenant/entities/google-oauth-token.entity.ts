import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GoogleOAuthTokenDocument = GoogleOAuthToken & Document;

@Schema({ timestamps: true })
export class GoogleOAuthToken {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  userEmail: string;

  @Prop({ required: true })
  accessToken: string;

  @Prop({ required: true })
  refreshToken: string;

  @Prop()
  expiryDate?: number;

  @Prop()
  scope?: string;

  @Prop()
  tokenType?: string;

  @Prop()
  grantId?: string;

  @Prop({ default: Date.now })
  connectedAt: Date;

  @Prop({ default: Date.now })
  lastRefreshedAt: Date;

  // Webhook subscription fields
  @Prop()
  webhookChannelId?: string;

  @Prop()
  webhookResourceId?: string;

  @Prop({ type: Date })
  webhookExpiration?: Date;

  @Prop()
  syncToken?: string; // For incremental sync
}

export const GoogleOAuthTokenSchema = SchemaFactory.createForClass(GoogleOAuthToken);

// Compound index for tenant + email uniqueness
GoogleOAuthTokenSchema.index({ tenantId: 1, userEmail: 1 }, { unique: true });

// Index for webhook channel lookup
GoogleOAuthTokenSchema.index({ webhookChannelId: 1 });
