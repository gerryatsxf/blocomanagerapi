import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Subscription, SubscriptionDocument, SubscriptionPlan, SubscriptionStatus } from './schemas/subscription.schema';
import { Tenant, TenantDocument } from '../tenant/schemas/tenant.schema';
import { User, UserDocument, UserRole } from '../users/entities/user.entity';
import { StripeService } from './stripe.service';
import { PlanService } from './plan.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly stripeService: StripeService,
    private readonly planService: PlanService,
    private readonly notificationService: NotificationService,
  ) {}

  // ── Onboarding: create Stripe customer + trial subscription ──

  async onboardTenant(params: {
    tenantId: string;
    email: string;
    tenantName: string;
    plan?: SubscriptionPlan;
    planSlug?: string;
  }): Promise<Subscription> {
    const tenant = await this.tenantModel.findOne({ tenantId: params.tenantId });
    if (!tenant) throw new NotFoundException(`Tenant ${params.tenantId} not found`);

    // Check if already subscribed — allow re-onboard if canceled
    const existing = await this.subscriptionModel.findOne({ tenantId: params.tenantId });
    if (existing) {
      if (['canceled', 'unpaid'].includes(existing.status)) {
        this.logger.log(`Removing stale ${existing.status} subscription for re-onboard: ${params.tenantId}`);
        await this.subscriptionModel.deleteOne({ tenantId: params.tenantId });
      } else {
        throw new BadRequestException(`Tenant already has an ${existing.status} subscription`);
      }
    }

    // 1. Create Stripe Customer
    const customer = await this.stripeService.createCustomer({
      email: params.email,
      name: params.tenantName,
      metadata: { tenantId: params.tenantId },
    });

    this.logger.log(`Created Stripe customer ${customer.id} for tenant ${params.tenantId}`);

    // 2. Determine price and trial from the plan in the database
    const plan = params.plan ?? SubscriptionPlan.FREE_TRIAL;
    const resolved = await this.resolvePlan(plan, params.planSlug);
    const priceId = resolved.stripePriceId;
    const trialDays = resolved.trialDays;

    // 3. Create Stripe Subscription with trial
    const stripeSub = await this.stripeService.createSubscription({
      customerId: customer.id,
      priceId,
      trialDays,
      metadata: { tenantId: params.tenantId },
    });

    // 4. Save to DB
    const subscription = await this.subscriptionModel.create({
      tenantId: params.tenantId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: priceId,
      plan,
      status: SubscriptionStatus.TRIALING,
      trialStart: stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000) : new Date(),
      trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : undefined,
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    });

    // 5. Update tenant record
    await this.tenantModel.updateOne(
      { tenantId: params.tenantId },
      { stripeCustomerId: customer.id, subscriptionStatus: 'trialing' },
    );

    this.logger.log(`Tenant ${params.tenantId} onboarded: plan=${plan}, trial=${trialDays}d`);
    return subscription;
  }

  // ── Status ──

  async getSubscription(tenantId: string): Promise<Subscription | null> {
    return this.subscriptionModel.findOne({ tenantId }).lean();
  }

  async getStatus(tenantId: string) {
    const sub = await this.subscriptionModel.findOne({ tenantId }).lean();
    if (!sub) {
      return { subscribed: false, status: 'none', plan: null, trialEnd: null, currentPeriodEnd: null };
    }
    return {
      subscribed: true,
      status: sub.status,
      plan: sub.plan,
      trialEnd: sub.trialEnd,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }

  // ── Checkout (trial-to-paid or plan change) ──

  async createCheckoutSession(tenantId: string, plan: SubscriptionPlan, planSlug?: string) {
    const sub = await this.subscriptionModel.findOne({ tenantId });
    if (!sub) throw new NotFoundException('No subscription found — onboard the tenant first');

    const resolved = await this.resolvePlan(plan, planSlug);
    const tenantAppUrl = await this.getTenantUrl(tenantId);

    const session = await this.stripeService.createCheckoutSession({
      customerId: sub.stripeCustomerId,
      priceId: resolved.stripePriceId,
      successUrl: `${tenantAppUrl}/tenant/billing?billing=success`,
      cancelUrl: `${tenantAppUrl}/tenant/billing?billing=canceled`,
      metadata: { tenantId },
    });

    return { url: session.url };
  }

  // ── Billing Portal ──

  async createBillingPortalSession(tenantId: string) {
    const sub = await this.subscriptionModel.findOne({ tenantId });
    if (!sub) throw new NotFoundException('No subscription found');

    const tenantAppUrl = await this.getTenantUrl(tenantId);

    const session = await this.stripeService.createBillingPortalSession({
      customerId: sub.stripeCustomerId,
      returnUrl: `${tenantAppUrl}/tenant/settings`,
    });

    return { url: session.url };
  }

  // ── Cancel ──

  async cancelSubscription(tenantId: string, immediately = false) {
    const sub = await this.subscriptionModel.findOne({ tenantId });
    if (!sub?.stripeSubscriptionId) throw new NotFoundException('No active subscription');

    const updated = await this.stripeService.cancelSubscription(
      sub.stripeSubscriptionId,
      immediately,
    );

    await this.syncFromStripe(updated);
    return { status: updated.status, cancelAtPeriodEnd: updated.cancel_at_period_end };
  }

  // ── Change Plan (admin) ──

  async changePlan(tenantId: string, planSlug: string) {
    const sub = await this.subscriptionModel.findOne({ tenantId });
    if (!sub?.stripeSubscriptionId) throw new NotFoundException('No active subscription');

    const plan = await this.planService.findBySlug(planSlug);
    if (!plan) throw new BadRequestException(`Plan "${planSlug}" not found`);

    // Retrieve current Stripe subscription to get the item ID
    const stripeSub = await this.stripeService.getSubscription(sub.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) throw new BadRequestException('No subscription item found in Stripe');

    // Update the subscription item to the new price
    const updated = await this.stripeService.updateSubscriptionItem(
      sub.stripeSubscriptionId,
      itemId,
      plan.stripePriceId,
    );

    // Update local record
    await this.subscriptionModel.updateOne(
      { tenantId },
      { plan: planSlug, stripePriceId: plan.stripePriceId },
    );

    await this.syncFromStripe(updated);
    this.logger.log(`Changed plan for tenant ${tenantId} to ${planSlug}`);
    return { success: true, plan: planSlug, status: updated.status };
  }

  // ── Admin Billing Portal ──

  async createAdminPortalSession(tenantId: string) {
    const sub = await this.subscriptionModel.findOne({ tenantId });
    if (!sub) throw new NotFoundException('No subscription found');

    const session = await this.stripeService.createBillingPortalSession({
      customerId: sub.stripeCustomerId,
      returnUrl: `https://admin.blocomanager.com/admin/tenants`,
    });

    return { url: session.url };
  }

  // ── Webhook event processing ──

  async handleSubscriptionEvent(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) {
      this.logger.warn(`Subscription event ${event.type} missing tenantId metadata (sub: ${subscription.id})`);
      return;
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.syncFromStripe(subscription);
        break;

      case 'customer.subscription.deleted':
        await this.syncFromStripe(subscription);
        this.logger.warn(`Subscription canceled for tenant ${tenantId}`);
        break;

      case 'customer.subscription.trial_will_end':
        this.logger.log(`Trial ending soon for tenant ${tenantId}`);
        await this.sendTrialEndingNotification(tenantId, subscription);
        break;

      default:
        this.logger.log(`Unhandled subscription event: ${event.type}`);
    }
  }

  async handleInvoiceEvent(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

    if (!customerId) return;

    const sub = await this.subscriptionModel.findOne({ stripeCustomerId: customerId });
    if (!sub) {
      this.logger.warn(`Invoice event for unknown customer ${customerId}`);
      return;
    }

    if (event.type === 'invoice.payment_failed') {
      this.logger.warn(`Payment failed for tenant ${sub.tenantId}`);
      await this.subscriptionModel.updateOne(
        { tenantId: sub.tenantId },
        { status: SubscriptionStatus.PAST_DUE },
      );
      await this.tenantModel.updateOne(
        { tenantId: sub.tenantId },
        { subscriptionStatus: 'past_due' },
      );
      await this.sendPaymentFailedNotification(sub.tenantId);
    }
  }

  // ── Access check ──

  async hasActiveSubscription(tenantId: string): Promise<boolean> {
    const sub = await this.subscriptionModel.findOne({ tenantId }).lean();
    if (!sub) return false;
    return [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE].includes(sub.status);
  }

  // ── Helpers ──

  private async syncFromStripe(stripeSub: Stripe.Subscription) {
    const tenantId = stripeSub.metadata?.tenantId;
    if (!tenantId) return;

    const status = this.mapStripeStatus(stripeSub.status);

    await this.subscriptionModel.updateOne(
      { tenantId },
      {
        stripeSubscriptionId: stripeSub.id,
        status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : undefined,
        trialStart: stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000) : undefined,
        trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : undefined,
      },
      { upsert: true },
    );

    await this.tenantModel.updateOne(
      { tenantId },
      { subscriptionStatus: status },
    );

    this.logger.log(`Synced subscription for tenant ${tenantId}: ${status}`);
  }

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const map: Record<string, SubscriptionStatus> = {
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.CANCELED,
    };
    return map[stripeStatus] ?? SubscriptionStatus.CANCELED;
  }

  /**
   * Resolve a plan from the database — returns stripePriceId + trialDays.
   * Plans are managed via the admin panel (Admin → Plans).
   */
  private async resolvePlan(plan: SubscriptionPlan, planSlug?: string) {
    // 1. If a planSlug was provided, look it up directly
    if (planSlug) {
      try {
        return await this.planService.findBySlug(planSlug);
      } catch {
        throw new BadRequestException(`Plan "${planSlug}" not found. Create it in Admin → Plans first.`);
      }
    }

    // 2. Try to find a matching plan in DB by enum name → slug convention
    const slugFromEnum = plan.replace(/_/g, '-'); // e.g. free_trial → free-trial
    try {
      return await this.planService.findBySlug(slugFromEnum);
    } catch { /* not found, continue */ }

    // 3. Try the default plan
    const defaultPlan = await this.planService.getDefaultPlan();
    if (defaultPlan) return defaultPlan;

    throw new BadRequestException('No plans configured. Go to Admin → Plans and create at least one plan with a Stripe Price ID.');
  }

  /**
   * Look up the tenant admin user's email + display name.
   */
  private async getTenantAdminContact(tenantId: string): Promise<{ email: string; displayName: string } | null> {
    const admin = await this.userModel.findOne({
      tenant: tenantId,
      role: UserRole.TENANT_ADMIN,
    }).lean();

    if (!admin) {
      this.logger.warn(`No tenantAdmin user found for tenant ${tenantId}`);
      return null;
    }

    const displayName = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email;
    return { email: admin.email, displayName };
  }

  /**
   * Send trial-ending email to tenant admin.
   */
  private async sendTrialEndingNotification(tenantId: string, subscription: Stripe.Subscription) {
    const contact = await this.getTenantAdminContact(tenantId);
    if (!contact) return;

    const tenant = await this.tenantModel.findOne({ tenantId }).lean();
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : new Date();

    try {
      await this.notificationService.sendTrialEndingEmail(
        contact.email,
        contact.displayName,
        trialEnd,
        tenant?.domain,
      );
      this.logger.log(`Trial-ending email sent to ${contact.email} for tenant ${tenantId}`);
    } catch (err) {
      this.logger.error(`Failed to send trial-ending email for tenant ${tenantId}: ${err.message}`);
    }
  }

  /**
   * Send payment-failed dunning email to tenant admin.
   */
  private async sendPaymentFailedNotification(tenantId: string) {
    const contact = await this.getTenantAdminContact(tenantId);
    if (!contact) return;

    const tenant = await this.tenantModel.findOne({ tenantId }).lean();

    try {
      await this.notificationService.sendPaymentFailedEmail(
        contact.email,
        contact.displayName,
        tenant?.domain,
      );
      this.logger.log(`Payment-failed email sent to ${contact.email} for tenant ${tenantId}`);
    } catch (err) {
      this.logger.error(`Failed to send payment-failed email for tenant ${tenantId}: ${err.message}`);
    }
  }

  /**
   * Build the tenant's public URL from its domain.
   * e.g. tenant.domain = "aprendecoding" → https://aprendecoding.blocomanager.com
   */
  private async getTenantUrl(tenantId: string): Promise<string> {
    const tenant = await this.tenantModel.findOne({ tenantId }).lean();
    if (!tenant?.domain) {
      throw new NotFoundException(`Tenant ${tenantId} not found or has no domain`);
    }
    return `https://${tenant.domain}.blocomanager.com`;
  }
}
