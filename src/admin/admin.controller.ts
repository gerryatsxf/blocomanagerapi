import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { VpnOnlyGuard } from './guards/vpn-only.guard';
import { AdminService } from './admin.service';
import { UserRole } from '../users/entities/user.entity';
import { RequestSuperAdminDto, GrantSuperAdminDto } from './dto/super-admin-grant.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(VpnOnlyGuard) // All admin routes require VPN access
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user account' })
  async deleteUser(@Param('userId') userId: string) {
    return this.adminService.deleteUser(userId);
  }

  @Get('users/:userId/activity')
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

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get all subscriptions' })
  async getAllSubscriptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllSubscriptions(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Patch('subscriptions/:userId')
  @ApiOperation({ summary: 'Update user subscription' })
  async updateSubscription(
    @Param('userId') userId: string,
    @Body('planId') planId: string,
  ) {
    return this.adminService.updateSubscription(userId, planId);
  }
}
