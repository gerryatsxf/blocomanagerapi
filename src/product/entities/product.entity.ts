import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentProvider } from '../enums/payment-provider.enum';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @ApiProperty({
    description: 'Product name',
    example: 'Consultoría de 50 minutos',
  })
  @Prop({ required: true })
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'Sesión de consultoría personalizada',
  })
  @Prop({ required: true })
  description: string;

  @ApiProperty({
    description: 'Product price in centavos (e.g., 49950 = $499.50 MXN)',
    example: 49950,
  })
  @Prop({ required: true })
  price: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'MXN',
    default: 'MXN',
  })
  @Prop({ default: 'MXN' })
  currency: string;

  @ApiProperty({
    description: 'Payment provider for this product',
    example: 'stripe',
    enum: PaymentProvider,
    default: PaymentProvider.STRIPE,
  })
  @Prop({ 
    type: String,
    enum: PaymentProvider,
    default: PaymentProvider.STRIPE 
  })
  paymentProvider: PaymentProvider;

  @ApiProperty({
    description: 'Payment provider product/price ID (Stripe Price ID, Clip product ID, etc.)',
    example: 'price_1ABC123xyz',
    required: false,
  })
  @Prop()
  paymentProviderProductId?: string;

  @ApiProperty({
    description: 'Whether the product is active and available for purchase',
    example: true,
    default: true,
  })
  @Prop({ default: true })
  active: boolean;

  @ApiProperty({
    description: 'Tenant that owns this product',
    example: 'blocomanager',
  })
  @Prop({ required: true, index: true })
  tenant: string;

  @ApiProperty({
    description: 'Product creation timestamp',
  })
  createdAt?: Date;

  @ApiProperty({
    description: 'Product last update timestamp',
  })
  updatedAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
