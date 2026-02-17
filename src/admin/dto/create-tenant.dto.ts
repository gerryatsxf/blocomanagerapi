import { IsString, IsNotEmpty, IsOptional, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Unique identifier for the tenant (lowercase, alphanumeric, no spaces)',
    example: 'newcompany',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+$/, {
    message: 'Tenant ID must be lowercase alphanumeric with no spaces',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Primary domain for the tenant',
    example: 'newcompany.com',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, {
    message: 'Domain must be a valid domain format',
  })
  domain: string;

  @ApiProperty({
    description: 'Display name of the tenant',
    example: 'New Company Inc.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the tenant',
    example: 'Professional services company',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
