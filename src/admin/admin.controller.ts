import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { AdminOrTenantAdminGuard } from './guards/admin-or-tenant-admin.guard';
import { VpnOnlyGuard } from './guards/vpn-only.guard';
import { AdminService } from './admin.service';
import { UserRole } from '../users/entities/user.entity';
import { RequestSuperAdminDto, GrantSuperAdminDto } from './dto/super-admin-grant.dto';
import { BulkDeleteUsersDto } from './dto/bulk-delete-users.dto';
import { CreateUserInviteDto } from './dto/create-user-invite.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ProductService } from '../product/product.service';
import { CreateProductDto } from '../product/dto/create-product.dto';
import { UpdateProductDto } from '../product/dto/update-product.dto';
import { GoogleOAuthService } from '../tenant/google-oauth.service';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(VpnOnlyGuard) // All admin routes require VPN access
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly productService: ProductService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  // ==================== SUPER ADMIN GRANT (NO AUTH) ====================

  @Post('request-superadmin')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Request super admin grant code (NO AUTH)',
    description: 'Sends a 6-digit code to ADMIN_EMAIL. Rate limited to 3 requests per hour.',
  })
  async requestSuperAdminGrant(@Req() request: Request) {
    const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
    return this.adminService.requestSuperAdminGrant(ipAddress);
  }

  @Post('grant-superadmin')
  @Throttle({ default: { limit: 10, ttl: 300000 } }) // 10 attempts per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Grant super admin role using code (NO AUTH)',
    description: 'Validates 6-digit code and grants super admin role to target email.',
  })
  async grantSuperAdmin(@Body() dto: GrantSuperAdminDto) {
    return this.adminService.grantSuperAdmin(dto.code, dto.targetEmail);
  }

  // ==================== DASHBOARD (AUTH REQUIRED) ====================

  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ==================== USER MANAGEMENT ====================

  @Get('users')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users' })
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('userId') userId: string) {
    return this.adminService.getUserById(userId);
  }

  @Patch('users/:userId')
  @ApiOperation({ summary: 'Update user details' })
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateData: any,
  ) {
    return this.adminService.updateUser(userId, updateData);
  }

  @Patch('users/:userId/role')
  @ApiOperation({ summary: 'Update user role' })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body('role') role: UserRole,
  ) {
    return this.adminService.updateUserRole(userId, role);
  }

  @Delete('users/:userId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user account' })
  async deleteUser(@Param('userId') userId: string) {
    return this.adminService.deleteUser(userId);
  }

  @Post('users/bulk-delete')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Bulk delete multiple users',
    description: 'Delete multiple users at once. Super admin accounts will be skipped.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns summary of deleted, skipped, and failed deletions' 
  })
  async bulkDeleteUsers(@Body() dto: BulkDeleteUsersDto) {
    return this.adminService.bulkDeleteUsers(dto.userIds);
  }

  @Post('users/invite')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create new user and send invitation email',
    description: 'Creates a new user account and sends them an invitation email with their temporary credentials.',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User created successfully and invitation email sent' 
  })
  async createUserWithInvite(@Body() dto: CreateUserInviteDto) {
    return this.adminService.createUserWithInvite(
      dto.email,
      dto.temporaryPassword,
      dto.firstName,
      dto.lastName,
      dto.role || UserRole.USER,
    );
  }

  @Get('users/:userId/activity')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user activity and sessions' })
  async getUserActivity(@Param('userId') userId: string) {
    return this.adminService.getUserActivity(userId);
  }

  // ==================== TENANT MANAGEMENT ====================

  @Get('tenants')
  @ApiOperation({ summary: 'Get all tenants' })
  async getAllTenants() {
    return this.adminService.getAllTenants();
  }

  @Get('tenants/:tenantId')
  @ApiOperation({ summary: 'Get tenant data' })
  async getTenantData(@Param('tenantId') tenantId: string) {
    return this.adminService.getTenantData(tenantId);
  }

  @Post('tenants')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create new tenant (Super Admin only)',
    description: 'Creates a new tenant with a unique ID and domain.',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Tenant created successfully' 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Tenant ID or domain already exists' 
  })
  async createTenant(@Body() dto: CreateTenantDto) {
    return this.adminService.createTenant(dto);
  }

  @Patch('tenants/:tenantId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update tenant details (Super Admin only)',
    description: 'Updates tenant name and/or description. Tenant ID and domain cannot be changed.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant updated successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Tenant not found' 
  })
  async updateTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.adminService.updateTenant(tenantId, dto);
  }

  @Delete('tenants/:tenantId/undeploy')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undeploy tenant frontend' })
  @ApiResponse({ 
    status: 200, 
    description: 'Tenant frontend undeployed successfully' 
  })
  async undeployTenant(@Param('tenantId') tenantId: string) {
    return this.adminService.undeployTenant(tenantId);
  }

  @Get('tenants/:tenantId/admins')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tenant admin users for a tenant' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of tenant admin users' 
  })
  async getTenantAdmins(@Param('tenantId') tenantId: string) {
    return this.adminService.getTenantAdmins(tenantId);
  }

  @Post('tenants/:tenantId/admins/:userId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Assign a user as tenant admin',
    description: 'Sets user role to tenantAdmin and assigns them to the tenant. Validates that user is not already a tenant admin of another tenant.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User assigned as tenant admin successfully' 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'User is already a tenant admin of another tenant' 
  })
  async assignTenantAdmin(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminService.assignTenantAdmin(tenantId, userId);
  }

  @Delete('tenants/:tenantId/admins/:userId')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Remove a user from tenant admin role',
    description: 'Sets user role back to regular user and clears their tenant association.',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User removed from tenant admin successfully' 
  })
  async removeTenantAdmin(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminService.removeTenantAdmin(tenantId, userId);
  }

  // ==================== STORAGE PROVIDER CONFIGURATION ====================

  @Patch('tenants/:tenantId/storage-provider')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update storage provider for tenant (Super Admin only)' })
  async updateStorageProvider(
    @Param('tenantId') tenantId: string,
    @Body() body: { storageProvider: string; storageConfig?: Record<string, any> },
  ) {
    return this.adminService.updateStorageProvider(
      tenantId,
      body.storageProvider,
      body.storageConfig,
    );
  }

  // ==================== PAYMENT PROVIDER CONFIGURATION ====================

  @Post('tenants/:tenantId/payment-provider')
  @UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save payment provider configuration (Admin or Tenant Admin)' })
  async savePaymentProviderConfig(
    @Param('tenantId') tenantId: string,
    @Body() configData: any,
    @Req() request: Request,
  ) {
    // Validate tenant access
    const adminUser = request['adminUser'];
    if (adminUser.role !== UserRole.SUPER_ADMIN && adminUser.tenant !== tenantId) {
      return {
        success: false,
        message: 'Access denied: Cannot configure payment provider for another tenant',
      };
    }

    return this.adminService.savePaymentProviderConfig(tenantId, configData);
  }

  @Get('tenants/:tenantId/payment-providers')
  @UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment provider configurations (Admin or Tenant Admin)' })
  async getPaymentProviderConfigs(
    @Param('tenantId') tenantId: string,
    @Req() request: Request,
  ) {
    // Validate tenant access
    const adminUser = request['adminUser'];
    if (adminUser.role !== UserRole.SUPER_ADMIN && adminUser.tenant !== tenantId) {
      return {
        success: false,
        message: 'Access denied: Cannot view payment providers for another tenant',
      };
    }

    return this.adminService.getPaymentProviderConfigs(tenantId);
  }

  // ==================== PRODUCT MANAGEMENT ====================

  @Post('products')
  @UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new product (Admin or Tenant Admin)' })
  async createProduct(@Body() createProductDto: CreateProductDto, @Req() request: Request) {
    // Get tenant from authenticated user (attached by guard)
    const tenant = request['adminUser']?.tenant || 'blocomanager';
    return this.productService.create(createProductDto, tenant);
  }

  @Get('products')
  @UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all products (Admin or Tenant Admin)' })
  async getAllProducts(@Req() request: Request) {
    const adminUser = request['adminUser'];
    
    // Super admins see all products, tenant admins see only their tenant's products
    if (adminUser.role === UserRole.SUPER_ADMIN) {
      return this.productService.findAllForAdmin();
    } else {
      return this.productService.findByTenant(adminUser.tenant);
    }
  }

  @Get('products/:id')
  @UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product by ID (Admin or Tenant Admin)' })
  async getProduct(@Param('id') id: string, @Req() request: Request) {
    const product = await this.productService.findOne(id);
    const adminUser = request['adminUser'];
    if (adminUser.role !== UserRole.SUPER_ADMIN && product.tenant !== adminUser.tenant) {
      throw new ForbiddenException('Access denied: product belongs to another tenant');
    }
    return product;
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product (Admin or Tenant Admin)' })
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() request: Request,
  ) {
    const product = await this.productService.findOne(id);
    const adminUser = request['adminUser'];
    if (adminUser.role !== UserRole.SUPER_ADMIN && product.tenant !== adminUser.tenant) {
      throw new ForbiddenException('Access denied: product belongs to another tenant');
    }
    return this.productService.update(id, updateProductDto);
  }

  @Patch('products/:id/toggle-active')
  @UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle product active status (Admin or Tenant Admin)' })
  async toggleProductActive(@Param('id') id: string, @Req() request: Request) {
    const product = await this.productService.findOne(id);
    const adminUser = request['adminUser'];
    if (adminUser.role !== UserRole.SUPER_ADMIN && product.tenant !== adminUser.tenant) {
      throw new ForbiddenException('Access denied: product belongs to another tenant');
    }
    return this.productService.toggleActive(id);
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete product (Super Admin only)' })
  async deleteProduct(@Param('id') id: string) {
    return this.productService.hardDelete(id);
  }

  // ==================== GOOGLE GRANTS ====================

  @Get('google-grants')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all Google OAuth grants with expiry status' })
  async getGoogleGrants() {
    const grants = await this.googleOAuthService.getAllGoogleGrants();
    const GRANT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    return grants.map(grant => {
      const connectedAt = new Date(grant.connectedAt).getTime();
      const expiresAt = connectedAt + GRANT_LIFETIME_MS;
      const hoursLeft = (expiresAt - now) / (1000 * 60 * 60);

      let status: string;
      if (hoursLeft <= 0) {
        status = 'expired';
      } else if (hoursLeft <= 48) {
        status = 'expiring_soon';
      } else {
        status = 'active';
      }

      return {
        _id: grant._id,
        tenantId: grant.tenantId,
        userEmail: grant.userEmail,
        connectedAt: grant.connectedAt,
        expiresAt: new Date(expiresAt),
        hoursLeft: Math.max(0, Math.round(hoursLeft)),
        status,
      };
    });
  }

  @Delete('google-grants/:id')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete expired Google OAuth grant (Super Admin only)' })
  async deleteGoogleGrant(@Param('id') id: string) {
    await this.googleOAuthService.deleteGoogleGrant(id);
    return { success: true, message: 'Google OAuth grant deleted' };
  }
}
