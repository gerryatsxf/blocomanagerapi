import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SubscriptionService } from '../subscription.service';

/**
 * Guard that ensures the requesting tenant has an active (or trialing) subscription.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, TenantGuard, SubscriptionGuard)
 *
 * Must run AFTER TenantGuard so that `request.tenant` is already populated.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.tenant;

    if (!tenantId) {
      this.logger.warn('SubscriptionGuard — no tenantId on request (TenantGuard missing?)');
      throw new ForbiddenException('Tenant context required');
    }

    const active = await this.subscriptionService.hasActiveSubscription(tenantId);

    if (!active) {
      this.logger.warn(`SubscriptionGuard — tenant ${tenantId} has no active subscription`);
      throw new ForbiddenException(
        'An active subscription is required to access this resource',
      );
    }

    this.logger.debug(`SubscriptionGuard — tenant ${tenantId} subscription active`);
    return true;
  }
}
