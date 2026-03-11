import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AvailabilityService } from '../availability/availability.service';
import { CalendarService } from '../calendar/calendar.service';

@ApiTags('Admin Availability')
@Controller('admin')
export class AdminAvailabilityController {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly calendarService: CalendarService,
  ) {}

  /**
   * GET /admin/availability - Get current tenant's availability
   */
  @UseGuards(JwtAuthGuard)
  @Get('availability')
  @ApiBearerAuth()
  async getAvailability(@Request() req) {
    const tenantId = req.user?.tenant;
    const config = await this.availabilityService.getAvailability(tenantId);
    return {
      availability: config || {
        tenantId,
        timezone: 'America/Monterrey',
        sessionDuration: 30,
        availableDays: [],
        availableHours: [],
      },
      timezones: this.calendarService.getTimezoneList(),
    };
  }

  /**
   * PUT /admin/availability - Update current tenant's availability
   */
  @UseGuards(JwtAuthGuard)
  @Put('availability')
  @ApiBearerAuth()
  async updateAvailability(
    @Request() req,
    @Body()
    body: {
      timezone?: string;
      sessionDuration?: number;
      availableDays?: string[];
      availableHours?: { startTime: string; endTime: string }[];
    },
  ) {
    const tenantId = req.user?.tenant;
    const updated = await this.availabilityService.saveAvailability(tenantId, body);
    return { availability: updated };
  }

  /**
   * GET /admin/tenants/:tenantId/availability - Super admin: get tenant availability
   */
  @UseGuards(JwtAuthGuard)
  @Get('tenants/:tenantId/availability')
  @ApiBearerAuth()
  async getTenantAvailability(@Param('tenantId') tenantId: string) {
    const config = await this.availabilityService.getAvailability(tenantId);
    return {
      availability: config || {
        tenantId,
        timezone: 'America/Monterrey',
        sessionDuration: 30,
        availableDays: [],
        availableHours: [],
      },
      timezones: this.calendarService.getTimezoneList(),
    };
  }

  /**
   * PUT /admin/tenants/:tenantId/availability - Super admin: update tenant availability
   */
  @UseGuards(JwtAuthGuard)
  @Put('tenants/:tenantId/availability')
  @ApiBearerAuth()
  async updateTenantAvailability(
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      timezone?: string;
      sessionDuration?: number;
      availableDays?: string[];
      availableHours?: { startTime: string; endTime: string }[];
    },
  ) {
    const updated = await this.availabilityService.saveAvailability(tenantId, body);
    return { availability: updated };
  }
}
