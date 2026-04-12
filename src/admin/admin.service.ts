import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from '../users/entities/user.entity';
import { SuperAdminGrant } from './entities/super-admin-grant.entity';
import { TENANT_CONFIGS, addTenantToConfig, removeTenantFromConfig } from '../tenant/config/tenant.config';
import { SessionService } from '../session/session.service';
import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../encryption/encryption.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ProvisioningService } from '../tenant/provisioning.service';
import { Tenant, TenantDocument } from '../tenant/schemas/tenant.schema';
import { Subscription, SubscriptionDocument } from '../subscription/schemas/subscription.schema';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SuperAdminGrant.name) private superAdminGrantModel: Model<SuperAdminGrant>,
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    private sessionService: SessionService,
    private notificationService: NotificationService,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
    private provisioningService: ProvisioningService,
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
      this.sessionService.deleteSessionsByUserId(userId),
    ]);

    return { message: 'User deleted successfully' };
  }

  async bulkDeleteUsers(userIds: string[]) {
    const results = {
      deleted: [] as string[],
      failed: [] as { userId: string; reason: string }[],
      skipped: [] as { userId: string; reason: string }[],
    };

    for (const userId of userIds) {
      try {
        const user = await this.userModel.findById(userId).exec();
        
        if (!user) {
          results.failed.push({ userId, reason: 'User not found' });
          continue;
        }

        // Skip super admin accounts
        if (user.role === UserRole.SUPER_ADMIN) {
          results.skipped.push({ 
            userId, 
            reason: 'Super admin accounts cannot be deleted through admin panel' 
          });
          continue;
        }

        await this.userModel.findByIdAndDelete(userId).exec();

        // Clean up related data
        await Promise.all([
          this.sessionService.deleteSessionsByUserId(userId),
        ]);

        results.deleted.push(userId);
      } catch (error) {
        results.failed.push({ 
          userId, 
          reason: error.message || 'Unknown error' 
        });
      }
    }

    return {
      message: `Bulk delete completed: ${results.deleted.length} deleted, ${results.skipped.length} skipped, ${results.failed.length} failed`,
      results,
    };
  }

  async createUserWithInvite(
    email: string,
    temporaryPassword: string,
    firstName?: string,
    lastName?: string,
    role: UserRole = UserRole.USER,
  ) {
    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Hash the temporary password
    const hashedPassword = await this.encryptionService.hash(temporaryPassword);

    // Create the user
    const newUser = new this.userModel({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      emailVerified: false, // User needs to verify email
      emailVerificationToken: crypto.randomBytes(32).toString('hex'),
    });

    await newUser.save();

    console.log(`👤 User created: ${email}`);
    console.log(`📧 Attempting to send invitation email...`);

    // Send invitation email with credentials
    let emailSent = false;
    try {
      await this.notificationService.sendUserInviteEmail(
        email,
        temporaryPassword,
        firstName,
      );
      emailSent = true;
      console.log(`✅ Invitation email sent successfully to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send invitation email:`, error.message);
      console.log(`⚠️  User created but email NOT sent. Email logged to console.`);
    }

    return {
      message: emailSent 
        ? 'User created successfully and invitation email sent'
        : 'User created successfully but invitation email could not be sent. Please check server logs or connect Google account in Settings.',
      emailSent,
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        emailVerified: newUser.emailVerified,
        createdAt: newUser.createdAt,
      },
      credentials: emailSent ? undefined : {
        email: newUser.email,
        temporaryPassword: temporaryPassword,
      },
    };
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

  /**
   * Get stale tenants: canceled, unpaid, or no subscription + no user activity.
   * Joins with User model to compute last login per tenant.
   */
  async getStaleTenants() {
    const staleStatuses = ['canceled', 'unpaid', 'none'];
    const staleTenants = await this.tenantModel
      .find({ subscriptionStatus: { $in: staleStatuses } })
      .lean()
      .exec();

    // For each stale tenant, get user count + last login
    const enriched = await Promise.all(
      staleTenants.map(async (tenant) => {
        const users = await this.userModel
          .find({ tenant: tenant.tenantId })
          .select('lastLoginAt createdAt email')
          .lean()
          .exec();

        const lastLoginDates = users
          .map(u => (u as any).lastLoginAt)
          .filter(Boolean)
          .map(d => new Date(d).getTime());

        const lastLoginAt = lastLoginDates.length > 0
          ? new Date(Math.max(...lastLoginDates))
          : null;

        return {
          _id: (tenant as any)._id,
          tenantId: tenant.tenantId,
          domain: tenant.domain,
          name: tenant.name,
          subscriptionStatus: tenant.subscriptionStatus,
          createdAt: (tenant as any).createdAt,
          updatedAt: (tenant as any).updatedAt,
          userCount: users.length,
          lastLoginAt,
        };
      }),
    );

    return { data: enriched };
  }

  /**
   * Purge a stale tenant: delete tenant doc, users, subscriptions, and remove from in-memory config.
   * Only allowed for tenants with stale subscription status.
   */
  async purgeStaleTenant(tenantId: string) {
    const tenant = await this.tenantModel.findOne({ tenantId }).exec();
    if (!tenant) {
      throw new NotFoundException(`Tenant "${tenantId}" not found`);
    }

    const safeStatuses = ['canceled', 'unpaid', 'none'];
    if (!safeStatuses.includes(tenant.subscriptionStatus || 'none')) {
      throw new BadRequestException(
        `Cannot purge tenant with subscription status "${tenant.subscriptionStatus}". Only canceled/unpaid/none tenants can be purged.`,
      );
    }

    // Delete users belonging to this tenant
    const userResult = await this.userModel.deleteMany({ tenant: tenantId }).exec();
    // Delete subscription records
    const subResult = await this.subscriptionModel.deleteMany({ tenantId }).exec();
    // Delete tenant document from MongoDB
    await this.tenantModel.deleteOne({ tenantId }).exec();
    // Remove from in-memory config
    removeTenantFromConfig(tenantId);

    this.logger.warn(
      `Purged tenant "${tenantId}": ${userResult.deletedCount} users, ${subResult.deletedCount} subscriptions deleted`,
    );

    return {
      success: true,
      tenantId,
      deletedUsers: userResult.deletedCount,
      deletedSubscriptions: subResult.deletedCount,
    };
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

  async createTenant(dto: CreateTenantDto) {
    // Check if tenant ID already exists
    if (TENANT_CONFIGS[dto.tenantId]) {
      throw new ConflictException(`Tenant with ID "${dto.tenantId}" already exists`);
    }

    // Check if domain is already in use
    const existingTenant = Object.values(TENANT_CONFIGS).find(
      config => config.domain === dto.domain
    );
    if (existingTenant) {
      throw new ConflictException(`Domain "${dto.domain}" is already used by tenant "${existingTenant.tenantId}"`);
    }

    // Add tenant to the config
    const newTenant = addTenantToConfig({
      tenantId: dto.tenantId,
      domain: dto.domain,
      name: dto.name,
      description: dto.description || '',
      deploymentStatus: 'pending',
    });

    // Trigger provisioning if enabled
    if (this.provisioningService.isEnabled()) {
      try {
        console.log(`🚀 Initiating provisioning for tenant: ${newTenant.tenantId}`);
        
        const result = await this.provisioningService.provisionTenant(newTenant);
        
        newTenant.deploymentStatus = result.status as any;
        newTenant.deploymentId = result.deploymentId;
        
        console.log(`📦 Provisioning initiated. Deployment ID: ${result.deploymentId}`);
      } catch (error) {
        console.error(`❌ Provisioning failed for tenant ${newTenant.tenantId}:`, error.message);
        newTenant.deploymentStatus = 'failed';
      }
    } else {
      console.log('⚠️ Provisioning service not enabled. Tenant created without frontend deployment.');
    }

    return {
      message: 'Tenant created successfully',
      tenant: newTenant,
    };
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
    const tenant = TENANT_CONFIGS[tenantId];
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    // If changing tenant ID, check it doesn't already exist
    if (dto.tenantId && dto.tenantId !== tenantId) {
      if (TENANT_CONFIGS[dto.tenantId]) {
        throw new ConflictException(`Tenant with ID "${dto.tenantId}" already exists`);
      }
    }

    // If changing domain, check it's not already in use
    if (dto.domain && dto.domain !== tenant.domain) {
      const existingTenant = Object.values(TENANT_CONFIGS).find(
        config => config.domain === dto.domain && config.tenantId !== tenantId
      );
      if (existingTenant) {
        throw new ConflictException(`Domain "${dto.domain}" is already used by tenant "${existingTenant.tenantId}"`);
      }
    }

    // Store old values for potential cleanup
    const oldTenantId = tenantId;
    const oldDomain = tenant.domain;

    // Update fields
    if (dto.tenantId !== undefined && dto.tenantId !== tenantId) {
      // Remove old tenant config
      delete TENANT_CONFIGS[oldTenantId];
      // Update tenant ID
      tenant.tenantId = dto.tenantId;
      // Add with new ID
      TENANT_CONFIGS[dto.tenantId] = tenant;
    }

    if (dto.domain !== undefined) {
      // Remove old domain mapping
      const TENANT_DOMAIN_MAPPING = require('../tenant/config/tenant.config').TENANT_DOMAIN_MAPPING;
      delete TENANT_DOMAIN_MAPPING[oldDomain];
      // Update domain
      tenant.domain = dto.domain;
      // Add new domain mapping
      TENANT_DOMAIN_MAPPING[dto.domain] = dto.tenantId || tenantId;
    }

    if (dto.name !== undefined) {
      tenant.name = dto.name;
    }

    if (dto.description !== undefined) {
      tenant.description = dto.description;
    }

    return {
      message: 'Tenant updated successfully',
      tenant,
      oldTenantId: dto.tenantId !== tenantId ? oldTenantId : undefined,
    };
  }

  async undeployTenant(tenantId: string) {
    const tenant = TENANT_CONFIGS[tenantId];
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    if (!this.provisioningService.isEnabled()) {
      throw new BadRequestException('Provisioning service is not enabled');
    }

    if (tenant.deploymentStatus !== 'deployed') {
      throw new BadRequestException(`Tenant is not currently deployed (status: ${tenant.deploymentStatus})`);
    }

    try {
      console.log(`🗑️ Initiating undeploy for tenant: ${tenantId}`);
      
      const result = await this.provisioningService.undeployTenant(tenantId);
      
      // Update tenant status
      tenant.deploymentStatus = 'undeployed';
      tenant.containerId = undefined;
      tenant.frontendUrl = undefined;
      tenant.deployedAt = undefined;
      
      console.log(`✅ Tenant ${tenantId} undeployed successfully`);
      
      return {
        message: result.message,
        tenant,
      };
    } catch (error) {
      console.error(`❌ Failed to undeploy tenant ${tenantId}:`, error.message);
      throw new BadRequestException(`Failed to undeploy tenant: ${error.message}`);
    }
  }

  async getTenantAdmins(tenantId: string) {
    const tenant = TENANT_CONFIGS[tenantId];
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    // Find all users who are tenant admins for this tenant
    const admins = await this.userModel
      .find({ tenant: tenantId, role: UserRole.TENANT_ADMIN })
      .select('-password')
      .lean();

    return admins;
  }

  async assignTenantAdmin(tenantId: string, userId: string) {
    const tenant = TENANT_CONFIGS[tenantId];
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate: User must not be a tenant admin of another tenant
    if (user.tenant && user.tenant !== tenantId && user.role === UserRole.TENANT_ADMIN) {
      throw new ConflictException(`User is already a tenant admin of tenant "${user.tenant}". Remove them from that tenant first.`);
    }

    // Update user role and tenant
    user.role = UserRole.TENANT_ADMIN;
    user.tenant = tenantId;
    await user.save();

    return {
      message: 'User assigned as tenant admin successfully',
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenant: user.tenant,
      },
    };
  }

  async removeTenantAdmin(tenantId: string, userId: string) {
    const tenant = TENANT_CONFIGS[tenantId];
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.tenant !== tenantId) {
      throw new BadRequestException('User is not a tenant admin of this tenant');
    }

    // Update user role back to regular user and clear tenant
    user.role = UserRole.USER;
    user.tenant = null;
    await user.save();

    return {
      message: 'User removed from tenant admin successfully',
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenant: user.tenant,
      },
    };
  }

  // ==================== PAYMENT PROVIDER CONFIGURATION ====================

  async savePaymentProviderConfig(tenantId: string, configData: any) {
    const tenant = TENANT_CONFIGS[tenantId];
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    const { provider, enabled, config } = configData;

    if (!provider || typeof enabled !== 'boolean' || !config) {
      throw new BadRequestException('Invalid payment provider configuration');
    }

    // Encrypt sensitive keys
    const encryptedConfig = { ...config };
    const sensitiveKeys = ['apiKey', 'secretKey', 'webhookSecret'];
    
    for (const key of sensitiveKeys) {
      if (config[key]) {
        encryptedConfig[key] = this.encryptionService.encrypt(config[key]);
      }
    }

    // Initialize settings if not exists
    if (!tenant.settings) {
      tenant.settings = {};
    }
    if (!tenant.settings.paymentProviders) {
      tenant.settings.paymentProviders = [];
    }

    // Update or add provider config
    const existingIndex = tenant.settings.paymentProviders.findIndex(
      p => p.provider === provider
    );

    const providerConfig = {
      provider,
      enabled,
      config: encryptedConfig,
    };

    if (existingIndex >= 0) {
      tenant.settings.paymentProviders[existingIndex] = providerConfig;
    } else {
      tenant.settings.paymentProviders.push(providerConfig);
    }

    return {
      message: 'Payment provider configuration saved successfully',
      provider,
      enabled,
    };
  }

  async getPaymentProviderConfigs(tenantId: string) {
    const tenant = TENANT_CONFIGS[tenantId];
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    const providers = tenant.settings?.paymentProviders || [];

    // Decrypt sensitive keys for display (show masked version)
    const decryptedProviders = providers.map(p => {
      const config = { ...p.config };
      const sensitiveKeys = ['apiKey', 'secretKey', 'webhookSecret'];
      
      for (const key of sensitiveKeys) {
        if (config[key]) {
          try {
            // Decrypt and mask for display
            const decrypted = this.encryptionService.decrypt(config[key]);
            config[key] = '***' + decrypted.slice(-4); // Show only last 4 characters
          } catch (error) {
            config[key] = '***encrypted***';
          }
        }
      }

      return {
        provider: p.provider,
        enabled: p.enabled,
        config,
      };
    });

    return {
      paymentProviders: decryptedProviders,
    };
  }

  // ==================== STORAGE PROVIDER CONFIGURATION ====================

  async updateStorageProvider(tenantId: string, storageProvider: string, storageConfig?: Record<string, any>) {
    const tenant = TENANT_CONFIGS[tenantId];
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    const validProviders = ['local', 'aws_s3', 'azure_blob', 'google_cloud'];
    if (!validProviders.includes(storageProvider)) {
      throw new BadRequestException(`Invalid storage provider. Must be one of: ${validProviders.join(', ')}`);
    }

    tenant.storageProvider = storageProvider;
    if (storageConfig) {
      tenant.storageConfig = storageConfig;
    }

    return {
      message: 'Storage provider updated successfully',
      storageProvider: tenant.storageProvider,
    };
  }

  // ==================== PAYMENT/ANALYTICS ====================

  async getDashboardStats() {
    const [totalUsers, usersByRole] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      totalUsers,
      usersByRole,
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
