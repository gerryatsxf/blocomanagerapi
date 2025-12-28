import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from '../users/entities/user.entity';
import { Subscription } from '../subscription/entities/subscription.schema';
import { TENANT_CONFIGS } from '../tenant/config/tenant.config';
import { SessionService } from '../session/session.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<Subscription>,
    private sessionService: SessionService,
  ) {}

  // ==================== USER MANAGEMENT ====================

  async getAllUsers(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.userModel
        .find()
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(userId: string) {
    const user = await this.userModel.findById(userId).select('-password').lean().exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUser(userId: string, updateData: Partial<User>) {
    // Don't allow password updates through this endpoint
    delete updateData.password;
    
    const user = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserRole(userId: string, role: UserRole) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { role }, { new: true })
      .select('-password')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deleteUser(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deletion of super admin accounts (ARCO compliance - only self-deletion allowed)
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ConflictException('Super admin accounts cannot be deleted through admin panel. User must delete their own account to comply with ARCO regulations.');
    }

    await this.userModel.findByIdAndDelete(userId).exec();

    // Clean up related data
    await Promise.all([
      this.subscriptionModel.deleteOne({ userId }).exec(),
      this.sessionService.deleteSessionsByUserId(userId),
    ]);

    return { message: 'User deleted successfully' };
  }

  async getUserActivity(userId: string) {
    const sessions = await this.sessionService.findByUserId(userId);
    return {
      userId,
      sessions: sessions.map(session => ({
        id: session._id,
        tenant: session.tenant,
        createdAt: new Date(session.timestamp),
        lastActivity: new Date(session.timestamp + session.duration),
        isActive: session.status === 'active',
      })),
    };
  }

  // ==================== TENANT MANAGEMENT ====================

  async getAllTenants() {
    const tenants = Object.values(TENANT_CONFIGS).map(config => ({
      ...config,
    }));

    // Get user counts per tenant
    const tenantData = await Promise.all(
      tenants.map(async (tenant) => {
        const sessions = await this.sessionService.findByTenant(tenant.tenantId);
        const uniqueUserIds = new Set(
          sessions.filter(s => s.userId).map(s => s.userId)
        );
        
        return {
          ...tenant,
          userCount: uniqueUserIds.size,
          sessionCount: sessions.length,
        };
      })
    );

    return { data: tenantData };
  }

  async getTenantData(tenantId: string) {
    const tenantConfig = TENANT_CONFIGS[tenantId];
    if (!tenantConfig) {
      throw new NotFoundException('Tenant not found');
    }

    const sessions = await this.sessionService.findByTenant(tenantId);
    const userIds = [...new Set(sessions.filter(s => s.userId).map(s => s.userId))];
    
    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('-password')
      .lean()
      .exec();

    return {
      tenant: tenantConfig,
      users,
      sessions: sessions.map(s => ({
        id: s._id,
        userId: s.userId,
        createdAt: new Date(s.timestamp),
        lastActivity: new Date(s.timestamp + s.duration),
      })),
    };
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  async getAllSubscriptions(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const [subscriptions, total] = await Promise.all([
      this.subscriptionModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.subscriptionModel.countDocuments(),
    ]);

    // Enrich with user data
    const enrichedSubs = await Promise.all(
      subscriptions.map(async (sub) => {
        const user = await this.userModel.findById(sub.userId).select('email firstName lastName').lean().exec();
        return {
          ...sub,
          user,
        };
      })
    );

    return {
      data: enrichedSubs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateSubscription(userId: string, planId: string) {
    const subscription = await this.subscriptionModel
      .findOneAndUpdate(
        { userId },
        { planId },
        { new: true, upsert: true }
      )
      .exec();

    return subscription;
  }

  // ==================== PAYMENT/ANALYTICS ====================

  async getDashboardStats() {
    const [totalUsers, totalSubscriptions, usersByRole] = await Promise.all([
      this.userModel.countDocuments(),
      this.subscriptionModel.countDocuments(),
      this.userModel.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const subscriptionsByPlan = await this.subscriptionModel.aggregate([
      {
        $group: {
          _id: '$planId',
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      totalUsers,
      totalSubscriptions,
      usersByRole,
      subscriptionsByPlan,
    };
  }
}
