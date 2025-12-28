import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription } from '../entities/subscription.schema';
import { SubscriptionPlan, PlanId } from '../entities/subscription-plan.schema';

@Injectable()
export class SubscriptionService implements OnModuleInit {
  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<Subscription>,
    @InjectModel(SubscriptionPlan.name) private planModel: Model<SubscriptionPlan>,
  ) {}

  async onModuleInit() {
    await this.seedFreeTierPlan();
  }

  /**
   * Seed free tier plan on application startup
   * Ensures the free plan exists in database
   */
  private async seedFreeTierPlan(): Promise<void> {
    try {
      const existingPlan = await this.planModel.findOne({ planId: PlanId.FREE }).exec();
      
      if (!existingPlan) {
        const plan = new this.planModel({
          planId: PlanId.FREE,
          name: 'Free',
          features: {
            clientManagement: true,
            manualAppointments: true,
            googleCalendarSync: true,
          },
        });
        await plan.save();
        console.log('✅ Free tier plan seeded successfully');
      }
    } catch (error) {
      console.error('❌ Error seeding free tier plan:', error.message);
    }
  }

  /**
   * Create a free tier subscription for a new user
   * @param userId - User ID
   * @returns Created subscription
   */
  async createFreeTierSubscription(userId: string): Promise<Subscription> {
    const subscription = new this.subscriptionModel({
      userId,
      planId: PlanId.FREE,
    });

    return subscription.save();
  }

  /**
   * Get subscription by user ID
   * @param userId - User ID
   * @returns Subscription or null
   */
  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    return this.subscriptionModel.findOne({ userId }).exec();
  }

  /**
   * Get subscription details with plan features
   * @param userId - User ID
   * @returns Subscription with plan details or null
   */
  async getSubscriptionDetails(userId: string): Promise<{ subscription: Subscription; plan: SubscriptionPlan } | null> {
    const subscription = await this.subscriptionModel.findOne({ userId }).exec();
    if (!subscription) {
      return null;
    }

    const plan = await this.planModel.findOne({ planId: subscription.planId }).exec();
    if (!plan) {
      return null;
    }

    return { subscription, plan };
  }
}
