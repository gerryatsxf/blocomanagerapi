import { Controller, Get, Query, UseGuards, BadRequestException, Request } from '@nestjs/common';
import { FreeSlotService } from './free-slot.service';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SessionInfo } from '../session/decorators/session-info.decorator';
import { SessionService } from '../session/session.service';
import { UpdateSessionRequestDto } from '../session/dto/update-session-request.dto';
import { TenantService } from '../tenant/tenant.service';

@ApiTags('Free Time Slots')
@Controller('free-slot')
export class FreeSlotController {
  constructor(
    private readonly freeSlotService: FreeSlotService,
    private readonly sessionService: SessionService,
    private readonly tenantService: TenantService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiQuery({
    name: 'guestTimezone',
    required: false,
    type: String,
    description: 'The timezone of the guest. Defaults to America/Monterrey.',
  })
  @ApiBearerAuth()
  async getFreeSlots(
    @Query('guestTimezone') guestTimezone = 'America/Monterrey',
    @SessionInfo() sessionInfo,
    @Request() req,
  ) {
    // Prefer tenant resolved from request (X-Tenant-ID header in dev, or Origin domain),
    // fall back to session tenant if request-based resolution returns the default
    const requestTenant = this.tenantService.extractTenantFromRequest(req);
    const tenantId = (requestTenant && requestTenant !== 'blocomanager')
      ? requestTenant
      : sessionInfo?.tenant;

    if (!tenantId) {
      throw new BadRequestException('No tenant associated with this session.');
    }

    const updated = new UpdateSessionRequestDto();
    updated.timezone = guestTimezone;
    await this.sessionService.update(sessionInfo.id, updated);
    return this.freeSlotService.getFreeSlots(tenantId, guestTimezone);
  }
}
