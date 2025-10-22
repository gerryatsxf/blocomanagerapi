import { Controller, Get, Req, Res, UseGuards, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import { GoogleOAuthService } from './google-oauth.service';
import { TenantGuard } from './guards/tenant.guard';
import { Tenant } from './decorators/tenant.decorator';

@Controller('api/admin/auth/google')
@UseGuards(TenantGuard)
export class GoogleOAuthController {
  constructor(private readonly googleOAuthService: GoogleOAuthService) {}

  /**
   * Initiate Google OAuth flow for tenant admin
   * GET /api/admin/auth/google/connect
   */
  @Get('connect')
  async initiateGoogleAuth(
    @Tenant() tenantId: string,
    @Res() res: Response,
  ) {
    try {
      const authUrl = await this.googleOAuthService.generateAuthUrl(tenantId);
      return res.redirect(authUrl);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error initiating Google OAuth',
        error: error.message,
      });
    }
  }

  /**
   * Handle Google OAuth callback
   * GET /api/admin/auth/google/callback
   */
  @Get('callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code not provided',
        });
      }

      // Extract tenant from state parameter
      const tenantId = state;
      
      const result = await this.googleOAuthService.handleCallback(code, tenantId);
      
      return res.json({
        success: true,
        message: 'Google account connected successfully',
        data: {
          email: result.email,
          connectedAt: result.connectedAt,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error processing Google OAuth callback',
        error: error.message,
      });
    }
  }

  /**
   * Check Google OAuth connection status
   * GET /api/admin/auth/google/status
   */
  @Get('status')
  async getConnectionStatus(@Tenant() tenantId: string) {
    try {
      const status = await this.googleOAuthService.getConnectionStatus(tenantId);
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error checking Google OAuth status',
        error: error.message,
      };
    }
  }

  /**
   * Disconnect Google OAuth
   * DELETE /api/admin/auth/google/disconnect
   */
  @Get('disconnect')
  async disconnectGoogle(@Tenant() tenantId: string) {
    try {
      await this.googleOAuthService.disconnectGoogle(tenantId);
      return {
        success: true,
        message: 'Google account disconnected successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error disconnecting Google account',
        error: error.message,
      };
    }
  }
}