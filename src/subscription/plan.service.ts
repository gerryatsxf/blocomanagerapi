import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument } from './schemas/plan.schema';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>,
  ) {}

  async findAll(activeOnly = false): Promise<Plan[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return this.planModel.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  }

  async findBySlug(slug: string): Promise<Plan> {
    const plan = await this.planModel.findOne({ slug }).lean();
    if (!plan) throw new NotFoundException(`Plan "${slug}" not found`);
    return plan;
  }

  async findById(id: string): Promise<Plan> {
    const plan = await this.planModel.findById(id).lean();
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async getDefaultPlan(): Promise<Plan | null> {
    return this.planModel.findOne({ isDefault: true, isActive: true }).lean();
  }

  async getPriceId(planSlug: string): Promise<string> {
    const plan = await this.planModel.findOne({ slug: planSlug, isActive: true }).lean();
    if (!plan) throw new NotFoundException(`No active plan with slug "${planSlug}"`);
    return plan.stripePriceId;
  }

  async create(data: {
    name: string;
    slug: string;
    stripePriceId: string;
    price: number;
    currency?: string;
    interval?: string;
    features?: string[];
    trialDays?: number;
    isDefault?: boolean;
    sortOrder?: number;
  }): Promise<Plan> {
    const existing = await this.planModel.findOne({ slug: data.slug });
    if (existing) throw new ConflictException(`Plan slug "${data.slug}" already exists`);

    // If this is set as default, unset any existing default
    if (data.isDefault) {
      await this.planModel.updateMany({}, { isDefault: false });
    }

    const plan = await this.planModel.create(data);
    this.logger.log(`Created plan: ${plan.name} (${plan.slug}) → ${plan.stripePriceId}`);
    return plan;
  }

  async update(id: string, data: Partial<{
    name: string;
    slug: string;
    stripePriceId: string;
    price: number;
    currency: string;
    interval: string;
    features: string[];
    trialDays: number;
    isActive: boolean;
    isDefault: boolean;
    sortOrder: number;
  }>): Promise<Plan> {
    // If setting as default, unset others
    if (data.isDefault) {
      await this.planModel.updateMany({ _id: { $ne: id } }, { isDefault: false });
    }

    const plan = await this.planModel.findByIdAndUpdate(id, data, { new: true }).lean();
    if (!plan) throw new NotFoundException('Plan not found');
    this.logger.log(`Updated plan: ${plan.name} (${plan.slug})`);
    return plan;
  }

  async delete(id: string): Promise<void> {
    const plan = await this.planModel.findByIdAndDelete(id);
    if (!plan) throw new NotFoundException('Plan not found');
    this.logger.log(`Deleted plan: ${plan.name}`);
  }
}
