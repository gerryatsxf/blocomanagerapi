import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlanService } from './plan.service';
import { PlatformOwnerGuard } from '../admin/guards/platform-owner.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Plans')
@ApiBearerAuth()
@Controller('admin/plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @ApiOperation({ summary: 'List all subscription plans' })
  async findAll() {
    return this.planService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @ApiOperation({ summary: 'Create a subscription plan' })
  async create(
    @Body()
    body: {
      name: string;
      slug: string;
      stripePriceId: string;
      price: number;
      currency?: string;
      interval?: string;
      features?: string[];
      isDefault?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.planService.create(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @ApiOperation({ summary: 'Update a subscription plan' })
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      slug: string;
      stripePriceId: string;
      price: number;
      currency: string;
      interval: string;
      features: string[];
      isActive: boolean;
      isDefault: boolean;
      sortOrder: number;
    }>,
  ) {
    return this.planService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PlatformOwnerGuard)
  @ApiOperation({ summary: 'Delete a subscription plan' })
  async delete(@Param('id') id: string) {
    await this.planService.delete(id);
    return { success: true };
  }
}

// Public endpoint for tenants to see available plans (no auth)
@ApiTags('Plans')
@Controller('api/plans')
export class PublicPlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @ApiOperation({ summary: 'List active subscription plans (public)' })
  async findActive() {
    return this.planService.findAll(true);
  }
}
