import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TenantDocument = Tenant & Document;

@Schema({ timestamps: true })
export class Tenant {
  @Prop({ required: true, unique: true, index: true })
  tenantId: string;

  @Prop({ required: true, index: true })
  domain: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: 'local' })
  storageProvider?: string;

  @Prop()
  frontendUrl?: string;

  @Prop({ default: 'pending' })
  deploymentStatus?: string;

  @Prop()
  deployedAt?: Date;

  @Prop()
  containerId?: string;

  @Prop()
  deploymentId?: string;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
