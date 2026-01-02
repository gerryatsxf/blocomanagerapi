import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from '../users/entities/user.entity';
import { Subscription } from '../subscription/entities/subscription.schema';
import { SuperAdminGrant } from './entities/super-admin-grant.entity';
import { TENANT_CONFIGS } from '../tenant/config/tenant.config';
import { SessionService } from '../session/session.service';
import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<Subscription>,
    @InjectModel(SuperAdminGrant.name) private superAdminGrantModel: Model<SuperAdminGrant>,
    private sessionService: SessionService,
    private notificationService: NotificationService,
    private configService: ConfigService,
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

  // ==================== SUPER ADMIN GRANT FLOW ====================

  /**
   * Generate 6-digit code and send to admin email
   */
  async requestSuperAdminGrant(ipAddress: string): Promise<{ message: string }> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    
    if (!adminEmail) {
      throw new ConflictException('ADMIN_EMAIL not configured on server');
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    
    // Create grant record with 5-minute expiry
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
    await this.superAdminGrantModel.create({
      code,
      expiresAt,
      used: false,
      ipAddress,
    });

    // Send email with code
    const emailSubject = 'Super Admin Grant Code';
    const emailBody = `
      <h2>Super Admin Grant Request</h2>
      <p>A request has been made to grant super admin permissions.</p>
      <p><strong>Your 6-digit code:</strong></p>
      <h1 style="font-size: 48px; letter-spacing: 8px; color: #2563eb;">${code}</h1>
      <p>This code expires in 5 minutes.</p>
      <p><strong>IP Address:</strong> ${ipAddress}</p>
      <p>If you did not request this, please ignore this email.</p>
    `;
    
    // Use sendNotification with minimal structure
    await this.notificationService['sendGmailEmail'](
      adminEmail,
      emailSubject,
      emailBody,
      `Super Admin Grant Code: ${code}. Expires in 5 minutes. IP: ${ipAddress}`,
    );

    return {
      message: `Verification code sent to ${adminEmail}. Code expires in 5 minutes.`,
    };
  }

  /**
   * Validate code and grant super admin to target email
   */
  async grantSuperAdmin(code: string, targetEmail: string): Promise<{ message: string; user: any }> {
    // Find valid, unused code
    const grant = await this.superAdminGrantModel.findOne({
      code,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!grant) {
      throw new BadRequestException('Invalid or expired code');
    }

    // Find target user
    const user = await this.userModel.findOne({ email: targetEmail });
    
    if (!user) {
      throw new NotFoundException(`User with email ${targetEmail} not found`);
    }

    // Check if already super admin
    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ConflictException('User is already a super admin');
    }

    // Grant super admin role
    user.role = UserRole.SUPER_ADMIN;
    await user.save();

    // Mark code as used
    grant.used = true;
    grant.usedAt = new Date();
    grant.grantedToEmail = targetEmail;
    await grant.save();

    // Send confirmation email to admin
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (adminEmail) {
      const emailSubject = 'Super Admin Role Granted';
      const emailBody = `
        <h2>Super Admin Role Granted</h2>
        <p>Super admin permissions have been successfully granted to:</p>
        <p><strong>Email:</strong> ${targetEmail}</p>
        <p><strong>Name:</strong> ${user.firstName || ''} ${user.lastName || ''}</p>
        <p><strong>Granted at:</strong> ${new Date().toLocaleString()}</p>
      `;
      
      await this.notificationService['sendGmailEmail'](
        adminEmail,
        emailSubject,
        emailBody,
        `Super Admin Role Granted to ${targetEmail} at ${new Date().toLocaleString()}`,
      );
    }

    return {
      message: 'Super admin role granted successfully',
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
