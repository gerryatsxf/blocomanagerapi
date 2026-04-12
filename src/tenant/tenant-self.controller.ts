import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantService } from './tenant.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

// ── DTO ──────────────────────────────────────────────────────────

class UpdateMyTenantDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

// ── Controller ───────────────────────────────────────────────────

@ApiTags('Tenant Self-Service')
@Controller('api/tenant/details')
export class TenantSelfController {
  private readonly logger = new Logger(TenantSelfController.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Extract tenantId from session, ensuring the caller is a tenantAdmin.
   */
  private async requireTenantAdmin(req: any): Promise<string> {
    const session = req.user;
    if (!session?.userId) throw new ForbiddenException('No session');

    const user = await this.usersService.findById(session.userId);
    if (!user?.tenant) throw new ForbiddenException('You have no tenant assigned');
    if (user.role !== UserRole.TENANT_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only tenant admins can manage tenant details');
    }

    return user.tenant;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get own tenant details' })
  async getMyTenant(@Req() req: any) {
    const tenantId = await this.requireTenantAdmin(req);
    const tenant = await this.tenantService.findByTenantId(tenantId);
    return tenant;
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own tenant name / description' })
  async updateMyTenant(
    @Req() req: any,
    @Body() dto: UpdateMyTenantDto,
  ) {
    const tenantId = await this.requireTenantAdmin(req);
    const updated = await this.tenantService.updateTenantDetails(tenantId, dto);

    this.logger.log(`Tenant ${tenantId} updated by user ${req.user.userId}`);
    return { message: 'Tenant updated', tenant: updated };
  }
}
