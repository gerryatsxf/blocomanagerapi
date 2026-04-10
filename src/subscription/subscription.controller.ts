import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  Logger,
  RawBodyRequest,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { SuperAdminGuard } from '../admin/guards/super-admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionPlan } from './schemas/subscription.schema';
import { UsersService } from '../users/users.service';

// ── Admin endpoints (super admin onboards tenants) ──

@ApiTags('Subscriptions - Admin')
@ApiBearerAuth()
@Controller('admin/subscriptions')
export class SubscriptionAdminController {
  private readonly logger = new Logger(SubscriptionAdminController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('onboard')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Onboard a tenant with Stripe customer + trial subscription' })
  async onboardTenant(
    @Body() body: { tenantId: string; email: string; tenantName: string; plan?: SubscriptionPlan; planSlug?: string },
  ) {
    return this.subscriptionService.onboardTenant(body);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Get subscription status for a tenant' })
  async getStatus(@Req() req: Request & { query: { tenantId: string } }) {
    return this.subscriptionService.getStatus(req.query.tenantId);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Cancel a tenant subscription (admin)' })
  async adminCancel(@Body() body: { tenantId: string; immediately?: boolean }) {
    return this.subscriptionService.cancelSubscription(body.tenantId, body.immediately ?? false);
  }

  @Post('change-plan')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Change a tenant subscription plan (admin)' })
  async adminChangePlan(@Body() body: { tenantId: string; planSlug: string }) {
    return this.subscriptionService.changePlan(body.tenantId, body.planSlug);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Generate Stripe billing portal URL for a tenant (admin)' })
  async adminPortal(@Body() body: { tenantId: string }) {
    return this.subscriptionService.createAdminPortalSession(body.tenantId);
  }
}

// ── Tenant endpoints (tenant admins manage their own billing) ──

@ApiTags('Subscriptions - Tenant')
@ApiBearerAuth()
@Controller('api/tenant/billing')
export class SubscriptionTenantController {
  private readonly logger = new Logger(SubscriptionTenantController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Helper: extract tenant from the User document linked to the session.
   * Session.userId → User.tenant (the ground truth).
   */
  private async getTenantFromSession(req: any): Promise<string | null> {
    const session = req.user;
    if (!session?.userId) return null;
    const user = await this.usersService.findById(session.userId);
    return user?.tenant ?? null;
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get own subscription status' })
  async getStatus(@Req() req: Request) {
    const tenantId = await this.getTenantFromSession(req);
    if (!tenantId) return { subscribed: false, status: 'none' };
    return this.subscriptionService.getStatus(tenantId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Stripe Checkout session for upgrading/subscribing' })
  async createCheckout(
    @Req() req: Request,
    @Body() body: { plan?: SubscriptionPlan },
  ) {
    const tenantId = await this.getTenantFromSession(req);
    return this.subscriptionService.createCheckoutSession(
      tenantId,
      body.plan ?? SubscriptionPlan.STARTER,
    );
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Stripe Billing Portal session' })
  async createPortal(@Req() req: Request) {
    const tenantId = await this.getTenantFromSession(req);
    return this.subscriptionService.createBillingPortalSession(tenantId);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel subscription at end of period' })
  async cancel(@Req() req: Request) {
    const tenantId = await this.getTenantFromSession(req);
    return this.subscriptionService.cancelSubscription(tenantId, false);
  }
}

// ── Webhook endpoint (no auth — Stripe signature verification) ──

@ApiTags('Subscriptions - Webhook')
@Controller('subscription')
export class SubscriptionWebhookController {
  private readonly logger = new Logger(SubscriptionWebhookController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe subscription webhook handler' })
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Res() response: Response,
  ) {
    const signature = request.headers['stripe-signature'] as string;
    const secret = this.configService.get<string>('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET');

    if (!signature || !secret) {
      this.logger.error('Missing Stripe signature or webhook secret');
      return response.status(400).json({ error: 'Missing signature or secret' });
    }

    let event;
    try {
      event = this.stripeService.constructEvent(request.rawBody, signature, secret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      return response.status(400).json({ error: 'Invalid signature' });
    }

    this.logger.log(`Received Stripe event: ${event.type}`);

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
        case 'customer.subscription.trial_will_end':
          await this.subscriptionService.handleSubscriptionEvent(event);
          break;

        case 'invoice.payment_failed':
          await this.subscriptionService.handleInvoiceEvent(event);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error processing webhook event ${event.type}: ${err.message}`);
    }

    return response.status(200).json({ received: true });
  }
}
