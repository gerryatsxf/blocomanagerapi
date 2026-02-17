import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsPositive, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Consultoría de 50 minutos',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'Sesión de consultoría personalizada',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Product price in centavos (e.g., 49950 = $499.50 MXN)',
    example: 49950,
  })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({
    description: 'Payment provider',
    example: 'stripe',
    enum: PaymentProvider,
    default: PaymentProvider.STRIPE,
    required: false,
  })
  @IsEnum(PaymentProvider)
  @IsOptional()
  paymentProvider?: PaymentProvider;

  @ApiProperty({
    description: 'Payment provider product/price ID',
    example: 'price_1ABC123xyz',
    required: false,
  })
  @IsString()
  @IsOptional()
  paymentProviderProductId?: string;

  @ApiProperty({
    description: 'Whether the product is active',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiProperty({
    description: 'Tenant that owns this product',
    example: 'blocomanager',
    required: false,
  })
  @IsString()
  @IsOptional()
  tenant?: string;
}
