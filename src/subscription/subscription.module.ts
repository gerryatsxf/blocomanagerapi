import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { Plan, PlanSchema } from './schemas/plan.schema';
import { Tenant, TenantSchema } from '../tenant/schemas/tenant.schema';
import { User, UserSchema } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { TenantModule } from '../tenant/tenant.module';
import { NotificationModule } from '../notification/notification.module';
import { StripeService } from './stripe.service';
import { SubscriptionService } from './subscription.service';
import { PlanService } from './plan.service';
import { PlanController, PublicPlanController } from './plan.controller';
import {
  SubscriptionAdminController,
  SubscriptionTenantController,
  SubscriptionWebhookController,
} from './subscription.controller';
import { SubscriptionGuard } from './guards/subscription.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UsersModule,                      // PlatformOwnerGuard → UsersService
    forwardRef(() => TenantModule),   // TenantGuard → TenantService
    NotificationModule,               // Email notifications
  ],
  controllers: [
    PlanController,
    PublicPlanController,
    SubscriptionAdminController,
    SubscriptionTenantController,
    SubscriptionWebhookController,
  ],
  providers: [StripeService, SubscriptionService, PlanService, SubscriptionGuard],
  exports: [SubscriptionService, StripeService, PlanService, SubscriptionGuard],
})
export class SubscriptionModule {}
