import { IsString, IsOptional, MinLength, MaxLength, Matches, IsIn, ValidateNested, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class ResourceToggleDto {
  @IsBoolean()
  enabled: boolean;
}

class TenantResourcesDto {
  @ValidateNested()
  @Type(() => ResourceToggleDto)
  @IsOptional()
  adminPanel?: ResourceToggleDto;

  @ValidateNested()
  @Type(() => ResourceToggleDto)
  @IsOptional()
  visitorSite?: ResourceToggleDto;

  @ValidateNested()
  @Type(() => ResourceToggleDto)
  @IsOptional()
  dedicatedServer?: ResourceToggleDto;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({
    description: 'Unique identifier for the tenant (lowercase alphanumeric)',
    example: 'newcompany',
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+$/, {
    message: 'Tenant ID must be lowercase alphanumeric with no spaces',
  })
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Primary domain for the tenant',
    example: 'newcompany.com',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, {
    message: 'Domain must be a valid domain format',
  })
  domain?: string;

  @ApiPropertyOptional({
    description: 'Display name of the tenant',
    example: 'Updated Company Name',
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the tenant',
    example: 'Updated description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Infrastructure type for the tenant',
    example: 'shared',
    enum: ['shared', 'dedicated'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['shared', 'dedicated'])
  infrastructureType?: 'shared' | 'dedicated';

  @ApiPropertyOptional({
    description: 'Toggleable platform-managed resources for the tenant',
    example: { adminPanel: { enabled: true }, visitorSite: { enabled: true }, dedicatedServer: { enabled: false } },
  })
  @ValidateNested()
  @Type(() => TenantResourcesDto)
  @IsOptional()
  resources?: TenantResourcesDto;
}
