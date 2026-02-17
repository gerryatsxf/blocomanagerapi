import { ApiProperty } from '@nestjs/swagger';

export class ProductDto {
  @ApiProperty({
    description: 'Product ID',
  })
  id: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Consultoría de 50 minutos',
  })
  name: string;

  @ApiProperty({
    description: 'Product description',
    example: 'Sesión de consultoría personalizada',
  })
  description: string;

  @ApiProperty({
    description: 'Product price in centavos',
    example: 49950,
  })
  price: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'MXN',
  })
  currency: string;

  @ApiProperty({
    description: 'Whether the product is active',
    example: true,
  })
  active: boolean;

  @ApiProperty({
    description: 'Product creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Product last update timestamp',
  })
  updatedAt: Date;
}
