import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { AdminService } from './admin.service';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==================== DASHBOARD ====================

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ==================== USER MANAGEMENT ====================

  @Get('users')
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
