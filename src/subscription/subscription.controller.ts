import { Controller, Get, Request, UseGuards, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './services/subscription.service';
import { GetSubscriptionResponseDto } from './dto/get-subscription-response.dto';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @UseGuards(JwtAuthGuard)
  @Get('current')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user subscription',
    description: 'Returns the authenticated user\'s current subscription plan and features',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription details retrieved successfully',
    type: GetSubscriptionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 404,
    description: 'No subscription found for user',
  })
  async getCurrentSubscription(@Request() req): Promise<GetSubscriptionResponseDto> {
    const userId = req.user.userId;

    if (!userId) {
      throw new UnauthorizedException('This endpoint requires an authenticated user account');
    }

    const result = await this.subscriptionService.getSubscriptionDetails(userId);

    if (!result) {
      throw new NotFoundException('No subscription found for this user');
    }

    return {
      success: true,
      subscription: {
        planId: result.subscription.planId,
        planName: result.plan.name,
        features: result.plan.features,
        createdAt: result.subscription.createdAt,
      },
    };
  }
}
