import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TemplateDocument = Template & Document;

@Schema({ timestamps: true, collection: 'templates' })
export class Template {
  @Prop({ required: true })
  templateSlug: string;

  @Prop({ required: true })
  templateTenant: string;

  @Prop({ required: true, type: String })
  templateDescription: string;

  @Prop({ type: Object, default: {} })
  config: Record<string, any>;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);

// Create compound index for tenant + slug uniqueness
TemplateSchema.index({ templateTenant: 1, templateSlug: 1 }, { unique: true });
