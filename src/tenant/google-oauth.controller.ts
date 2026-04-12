import { Controller, Get, Post, Req, Res, UseGuards, Logger, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { TenantGuard } from './guards/tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleCalendarService } from './google-calendar.service';
import { ScheduleEventParamsDto } from '../calendar/dto/schedule-event-params.dto';
import { getTenantConfig, getAuthorizedProviders } from './config/tenant-email.config';
import { Tenant } from './decorators/tenant.decorator';
import { WebhookSubscriptionService } from '../calendar/services/webhook-subscription.service';

@Controller('api/admin/auth/google')
@UseGuards(TenantGuard)
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name);

  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly webhookSubscriptionService: WebhookSubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initiate Google OAuth flow for tenant admin
   * GET /api/admin/auth/google/connect
   */
  @Get('connect')
  async initiateGoogleAuth(
    @Tenant() tenantId: string,
    @Query('panel') panel: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.debug(`Initiating Google OAuth for tenant: ${tenantId}, panel: ${panel || 'tenant'}`);
      const authUrl = await this.googleOAuthService.generateAuthUrl(tenantId, panel || 'tenant');
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
      // Parse composite state: "tenantId:panel" (e.g. "blocomanager:admin")
      const parts = (state || '').split(':');
      const tenantId = parts[0];
      const panel = parts[1] || 'tenant';

      // Determine redirect base URL and path based on originating panel
      const getRedirectBase = () => {
        if (panel === 'admin') {
          return {
            base: (this.configService.get<string>('ADMIN_APP_URL') || '').replace(/\/+$/, ''),
            path: '/admin/settings',
          };
        }
        return {
          base: (this.configService.get<string>('TENANT_APP_URL') || '').replace(/\/+$/, ''),
          path: '/tenant/calendar',
        };
      };

      if (!code) {
        this.logger.error('No authorization code provided');
        const { base, path } = getRedirectBase();
        return res.redirect(`${base}${path}?error=` + encodeURIComponent('Authorization code not provided'));
      }

      const result = await this.googleOAuthService.handleCallback(code, tenantId);
      
      this.logger.log(`Google account connected successfully: ${result.email}`);
      
      // Register webhook subscription for calendar changes
      try {
        const webhookResult = await this.webhookSubscriptionService.registerGoogleWebhook(
          result.detectedTenant || tenantId,
          result.email,
        );
        
        if (webhookResult.success) {
          this.logger.log(`Webhook registered successfully, expires: ${webhookResult.expiration}`);
        } else {
          this.logger.warn(`Failed to register webhook: ${webhookResult.message}`);
        }
      } catch (webhookError) {
        this.logger.error(`Error registering webhook: ${webhookError.message}`);
        // Don't fail the OAuth connection if webhook registration fails
      }
      
      // Redirect back to the panel the user came from
      const { base, path } = getRedirectBase();
      return res.redirect(`${base}${path}?success=` + encodeURIComponent('Google account connected successfully'));
      
    } catch (error) {
      this.logger.error(`Error in Google OAuth callback: ${error.message}`);
      // Best-effort redirect: parse state again for panel
      const parts = (state || '').split(':');
      const panel = parts[1] || 'tenant';
      const base = panel === 'admin'
        ? (this.configService.get<string>('ADMIN_APP_URL') || '').replace(/\/+$/, '')
        : (this.configService.get<string>('TENANT_APP_URL') || '').replace(/\/+$/, '');
      const path = panel === 'admin' ? '/admin/settings' : '/tenant/calendar';
      return res.redirect(`${base}${path}?error=` + encodeURIComponent(error.message));
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
   * GET /api/admin/auth/google/disconnect
   */
  @Get('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnectGoogle(@Req() request: Request) {
    // Get tenant from JWT session (request.user is set by passport JWT)
    // This avoids the @Tenant() decorator which resolves from origin domain
    // and fails when accessed via ngrok or non-mapped domains
    const session = request['user'];
    const tenantId = session?.tenant;
    this.logger.log(`Disconnect requested for tenant: ${tenantId} (session user: ${session?.userId})`);
    try {
      await this.googleOAuthService.disconnectGoogle(tenantId);
      return {
        success: true,
        message: 'Google account disconnected successfully',
      };
    } catch (error) {
      this.logger.error(`Disconnect failed for tenant ${tenantId}: ${error.message}`);
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
          adminEmail: tenantConfig.adminEmail,
          authorizedProviders: tenantConfig.authorizedProviders,
          isActive: tenantConfig.isActive,
        },
        authentication: {
          isAuthenticated: authCheck.isAuthenticated,
          authenticatedProviders: authCheck.authenticatedProviders || [],
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
  // CALENDAR ENDPOINTS - Using Google Calendar API directly (not Nylas)
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

      // Get provider tokens
      const providerTokens = await this.googleOAuthService.getStoredTokens(tenantId, authCheck.email);
      
      if (!providerTokens) {
        throw new HttpException('No Google tokens found for this provider', HttpStatus.UNAUTHORIZED);
      }

      const calendarInfo = await this.googleCalendarService.testCalendarAccess(providerTokens.tokens);
      
      return {
        success: true,
        tenant: tenantId,
        authenticatedEmail: authCheck.email,
        data: {
          calendar: calendarInfo,
          message: 'Using Google Calendar API directly',
        },
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

      // Get provider tokens - we need to specify which provider's calendar to use
      // For now, let's use the first authenticated provider (could be made configurable)
      const firstProvider = authCheck.authenticatedProviders?.[0] || authCheck.email;
      const providerTokens = await this.googleOAuthService.getStoredTokens(tenantId, firstProvider);
      
      if (!providerTokens) {
        throw new HttpException('No Google tokens found for the provider', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`📅 Creating event in ${firstProvider}'s calendar for tenant ${tenantId}`);

      const event = await this.googleCalendarService.createEvent(providerTokens.tokens, {
        title: eventData.title,
        description: eventData.description,
        startTime: new Date(eventData.eventStartTime),
        endTime: new Date(eventData.eventEndTime),
        attendees: [
          {
            email: eventData.customerEmail,
            displayName: eventData.customerName,
          },
          // Also add the provider as attendee so they see it in their calendar
          {
            email: firstProvider,
            displayName: 'Host', // Provider will be the organizer
          },
        ],
        meetingLink: eventData.hostMeetingLink || eventData.guestMeetingLink,
        timezone: 'America/Mexico_City',
      });

      return {
        success: true,
        message: 'Event created successfully in provider\'s Google Calendar',
        tenant: tenantId,
        provider: firstProvider,
        data: {
          eventId: event.id,
          eventLink: event.htmlLink,
          meetingLink: event.meetLink,
          organizer: event.organizer,
          attendees: event.attendees,
        },
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
   * Test calendar event creation
   * POST /api/admin/auth/google/test-event
   */
  @Post('test-event')
  @ApiOperation({ summary: 'Test calendar event creation' })
  async testEventCreation(@Tenant() tenantId: string) {
    try {
      // 🔐 VALIDATION: Check if tenant is authenticated
      const authCheck = await this.googleOAuthService.isTenantAuthenticated(tenantId);
      if (!authCheck.isAuthenticated) {
        throw new HttpException(authCheck.message, HttpStatus.UNAUTHORIZED);
      }

      const firstProvider = authCheck.authenticatedProviders?.[0] || authCheck.email;
      const providerTokens = await this.googleOAuthService.getStoredTokens(tenantId, firstProvider);
      
      if (!providerTokens) {
        throw new HttpException('No Google tokens found for provider', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`🧪 Creating TEST event for tenant ${tenantId}, provider: ${firstProvider}`);

      // Create a simple test event 1 hour from now
      const startTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const endTime = new Date(Date.now() + 120 * 60 * 1000); // 2 hours from now

      const event = await this.googleCalendarService.createEvent(providerTokens.tokens, {
        title: `🧪 TEST EVENT - ${tenantId}`,
        description: `This is a test event created via API for tenant ${tenantId}`,
        startTime: startTime,
        endTime: endTime,
        attendees: [
          {
            email: 'onlinepaymentsgerry1234@gmail.com',
            displayName: 'Test End User',
          },
        ],
        timezone: 'America/Mexico_City',
      });

      return {
        success: true,
        message: 'Test event created successfully',
        data: {
          eventId: event.id,
          eventLink: event.htmlLink,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          organizer: event.organizer,
          attendees: event.attendees,
          tenant: tenantId,
          provider: firstProvider,
        },
      };
    } catch (error) {
      this.logger.error(`Error creating test event for tenant ${tenantId}:`, error);
      throw new HttpException(
        `Error creating test event: ${error.message}`,
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
      // Check tenant authentication status
      const authCheck = await this.googleOAuthService.isTenantAuthenticated(tenantId);
      
      if (!authCheck.isAuthenticated) {
        return {
          success: false,
          message: authCheck.message,
          connected: false,
        };
      }

      // Test all authenticated providers
      const results = [];
      for (const providerEmail of authCheck.authenticatedProviders || []) {
        const providerTokens = await this.googleOAuthService.getStoredTokens(tenantId, providerEmail);
        if (providerTokens) {
          const connectionTest = await this.googleCalendarService.testCalendarAccess(providerTokens.tokens);
          results.push({
            provider: providerEmail,
            ...connectionTest,
          });
        }
      }
      
      return {
        success: true,
        data: {
          tenant: tenantId,
          providerTests: results,
          totalProviders: results.length,
        },
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