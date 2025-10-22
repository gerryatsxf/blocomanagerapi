import { Controller, Get, Post, Req, Res, UseGuards, Logger, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { TenantGuard } from './guards/tenant.guard';
import { GoogleOAuthService } from './google-oauth.service';
import { NylasService } from '../nylas/nylas.service';
import { CalendarService } from '../calendar/calendar.service';
import { ScheduleEventParamsDto } from '../calendar/dto/schedule-event-params.dto';
import { getTenantConfig } from './config/tenant-email.config';
import { Tenant } from './decorators/tenant.decorator';

@Controller('api/admin/auth/google')
@UseGuards(TenantGuard)
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name);

  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly nylasService: NylasService,
    private readonly calendarService: CalendarService,
  ) {}

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
      this.logger.debug(`Initiating Google OAuth for tenant: ${tenantId}`);
      const authUrl = await this.googleOAuthService.generateAuthUrl(tenantId);
      this.logger.debug(`Generated auth URL: ${authUrl}`);
      return res.redirect(authUrl);
    } catch (error) {
      this.logger.error(`Error initiating Google OAuth: ${error.message}`);
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

  /**
   * Get tenant information and authentication status
   * GET /api/admin/auth/google/tenant-info
   */
  @Get('tenant-info')
  @ApiOperation({ summary: 'Get tenant information and authentication status' })
  @ApiResponse({ status: 200, description: 'Tenant information retrieved successfully' })
  async getTenantInfo(@Tenant() tenantId: string) {
    try {
      const tenantConfig = getTenantConfig(tenantId);
      if (!tenantConfig) {
        throw new HttpException(`Tenant '${tenantId}' not found`, HttpStatus.NOT_FOUND);
      }

      const authCheck = await this.googleOAuthService.isTenantAuthenticated(tenantId);

      return {
        success: true,
        tenant: {
          id: tenantConfig.tenantId,
          name: tenantConfig.name,
          domain: tenantConfig.domain,
          expectedEmail: tenantConfig.adminEmail,
          isActive: tenantConfig.isActive,
        },
        authentication: {
          isAuthenticated: authCheck.isAuthenticated,
          authenticatedEmail: authCheck.email,
          message: authCheck.message,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting tenant info for ${tenantId}:`, error);
      throw new HttpException(
        `Error getting tenant info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================================================
  // CALENDAR ENDPOINTS
  // ============================================================================

  /**
   * Get calendars for the authenticated tenant
   * GET /api/admin/auth/google/calendars
   */
  @Get('calendars')
  @ApiOperation({ summary: 'Get calendars for the authenticated tenant' })
  @ApiResponse({ status: 200, description: 'Calendars retrieved successfully' })
  async getCalendars(@Tenant() tenantId: string) {
    try {
      // 🔐 VALIDATION: Check if tenant is authenticated
      const authCheck = await this.googleOAuthService.isTenantAuthenticated(tenantId);
      if (!authCheck.isAuthenticated) {
        throw new HttpException(authCheck.message, HttpStatus.UNAUTHORIZED);
      }

      const grantId = await this.googleOAuthService.getStoredGrantId(tenantId);
      
      if (!grantId) {
        throw new HttpException('No Google account connected for this tenant', HttpStatus.UNAUTHORIZED);
      }

      const calendars = await this.nylasService.getCalendarsWithGrant(grantId);
      
      return {
        success: true,
        tenant: tenantId,
        authenticatedEmail: authCheck.email,
        data: calendars,
      };
    } catch (error) {
      this.logger.error(`Error fetching calendars for tenant ${tenantId}:`, error);
      throw new HttpException(
        `Error fetching calendars: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a calendar event for the authenticated tenant
   * POST /api/admin/auth/google/events
   */
  @Post('events')
  @ApiOperation({ summary: 'Create a calendar event for the authenticated tenant' })
  @ApiBody({ type: ScheduleEventParamsDto })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  async createEvent(
    @Tenant() tenantId: string,
    @Body() eventData: ScheduleEventParamsDto,
  ) {
    try {
      // 🔐 VALIDATION: Check if tenant is authenticated
      const authCheck = await this.googleOAuthService.isTenantAuthenticated(tenantId);
      if (!authCheck.isAuthenticated) {
        throw new HttpException(
          `Cannot create calendar event: ${authCheck.message}`,
          HttpStatus.UNAUTHORIZED
        );
      }

      const grantId = await this.googleOAuthService.getStoredGrantId(tenantId);
      
      if (!grantId) {
        throw new HttpException('No Google account connected for this tenant', HttpStatus.UNAUTHORIZED);
      }

      const event = await this.nylasService.createEventWithGrant(grantId, {
        title: eventData.title,
        description: eventData.description,
        startTime: eventData.eventStartTime,
        endTime: eventData.eventEndTime,
        participants: [
          {
            name: eventData.customerName,
            email: eventData.customerEmail,
          },
        ],
        busy: true,
        metadata: { 
          event_type: eventData.meetingType,
          tenant_id: tenantId,
          host_meeting_link: eventData.hostMeetingLink,
          guest_meeting_link: eventData.guestMeetingLink,
        },
        notifyParticipants: true,
      });

      return {
        success: true,
        message: 'Event created successfully',
        tenant: tenantId,
        authenticatedEmail: authCheck.email,
        data: event,
      };
    } catch (error) {
      this.logger.error(`Error creating event for tenant ${tenantId}:`, error);
      throw new HttpException(
        `Error creating event: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test calendar connection for the authenticated tenant
   * GET /api/admin/auth/google/test-connection
   */
  @Get('test-connection')
  @ApiOperation({ summary: 'Test calendar connection for the authenticated tenant' })
  @ApiResponse({ status: 200, description: 'Connection test completed' })
  async testConnection(@Tenant() tenantId: string) {
    try {
      // TODO: Get the actual grant ID from stored OAuth tokens for this tenant
      const grantId = await this.googleOAuthService.getStoredGrantId(tenantId);
      
      if (!grantId) {
        return {
          success: false,
          message: 'No Google account connected for this tenant',
          connected: false,
        };
      }

      const connectionTest = await this.nylasService.testGrantConnection(grantId);
      
      return {
        success: true,
        data: connectionTest,
      };
    } catch (error) {
      this.logger.error(`Error testing connection for tenant ${tenantId}:`, error);
      return {
        success: false,
        message: `Error testing connection: ${error.message}`,
        connected: false,
      };
    }
  }
}