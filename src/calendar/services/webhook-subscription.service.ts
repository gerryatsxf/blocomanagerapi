import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthService } from '../../tenant/google-oauth.service';
import { GoogleCalendarProvider } from './google-calendar.provider';

@Injectable()
export class WebhookSubscriptionService {
  private readonly logger = new Logger(WebhookSubscriptionService.name);

  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register Google Calendar webhook for a tenant
   */
  async registerGoogleWebhook(tenantId: string, userEmail: string): Promise<{
    success: boolean;
    channelId?: string;
    resourceId?: string;
    expiration?: Date;
    message: string;
  }> {
    try {
      // Get OAuth tokens for this tenant
      const storedTokens = await this.googleOAuthService.getStoredTokens(tenantId, userEmail);
      
      if (!storedTokens) {
        return {
          success: false,
          message: 'No OAuth tokens found for tenant',
        };
      }

      // Create calendar provider
      const provider = new GoogleCalendarProvider(
        this.configService,
        storedTokens.tokens.access_token,
        storedTokens.tokens.refresh_token,
      );

      // Get webhook callback URL
      const baseUrl = this.configService.get<string>('APP_BASE_URL') || 'http://localhost:3002';
      const callbackUrl = `${baseUrl}/calendar/webhooks/google`;

      this.logger.log(`Registering webhook for tenant ${tenantId}, callback: ${callbackUrl}`);

      // Subscribe to webhooks
      const subscription = await provider.subscribeToWebhooks(callbackUrl);

      // Store webhook info in database
      await this.googleOAuthService.updateWebhookSubscription(
        tenantId,
        userEmail,
        subscription.channelId,
        subscription.resourceId,
        subscription.expiration,
      );

      this.logger.log(
        `Webhook registered successfully for ${tenantId}, expires: ${subscription.expiration}`,
      );

      return {
        success: true,
        channelId: subscription.channelId,
        resourceId: subscription.resourceId,
        expiration: subscription.expiration,
        message: 'Webhook subscription registered successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to register webhook for ${tenantId}:`, error);
      return {
        success: false,
        message: `Failed to register webhook: ${error.message}`,
      };
    }
  }

  /**
   * Unregister Google Calendar webhook
   */
  async unregisterGoogleWebhook(tenantId: string, userEmail: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const storedTokens = await this.googleOAuthService.getStoredTokens(tenantId, userEmail);
      
      if (!storedTokens) {
        return {
          success: false,
          message: 'No OAuth tokens found',
        };
      }

      // Get webhook info from database
      const tokenDoc = await this.googleOAuthService.findByWebhookChannel(
        storedTokens.tokens.access_token, // This is a hack, need to refactor
      );

      if (!tokenDoc || !tokenDoc.webhookChannelId || !tokenDoc.webhookResourceId) {
        return {
          success: false,
          message: 'No webhook subscription found',
        };
      }

      // Create calendar provider
      const provider = new GoogleCalendarProvider(
        this.configService,
        storedTokens.tokens.access_token,
        storedTokens.tokens.refresh_token,
      );

      // Unsubscribe
      await provider.unsubscribeFromWebhooks(
        tokenDoc.webhookChannelId,
        tokenDoc.webhookResourceId,
      );

      // Clear webhook info from database
      await this.googleOAuthService.updateWebhookSubscription(
        tenantId,
        userEmail,
        null,
        null,
        null,
      );

      this.logger.log(`Webhook unregistered for ${tenantId}`);

      return {
        success: true,
        message: 'Webhook subscription removed',
      };
    } catch (error) {
      this.logger.error(`Failed to unregister webhook:`, error);
      return {
        success: false,
        message: `Failed to unregister: ${error.message}`,
      };
    }
  }

  /**
   * Check webhook connection status for a tenant
   */
  async getConnectionStatus(tenantId: string, userEmail: string): Promise<{
    connected: boolean;
    expiresIn?: number; // hours
    expiration?: Date;
    needsReconnection: boolean;
    message: string;
  }> {
    try {
      const storedTokens = await this.googleOAuthService.getStoredTokens(tenantId, userEmail);
      
      if (!storedTokens) {
        return {
          connected: false,
          needsReconnection: true,
          message: 'Not connected to Google Calendar',
        };
      }

      // Find token document to check webhook expiration and grant expiry
      const tokenDocs = await this.googleOAuthService['googleOAuthTokenModel']
        .find({ tenantId, userEmail })
        .exec();

      if (tokenDocs.length === 0) {
        return {
          connected: false,
          needsReconnection: true,
          message: 'Not connected to Google Calendar',
        };
      }

      const tokenDoc = tokenDocs[0];
      const now = new Date();

      // Check Google OAuth grant expiry (7 days in GCP Testing mode)
      const GRANT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
      const grantExpiresAt = new Date(new Date(tokenDoc.connectedAt).getTime() + GRANT_LIFETIME_MS);
      const grantExpired = now >= grantExpiresAt;
      const hoursUntilGrantExpiry = (grantExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (grantExpired || hoursUntilGrantExpiry <= 48) {
        return {
          connected: !grantExpired,
          expiresIn: Math.max(0, Math.round(hoursUntilGrantExpiry)),
          expiration: grantExpiresAt,
          needsReconnection: true,
          message: grantExpired
            ? 'Google grant expired (Testing mode 7-day limit). Please reconnect.'
            : `Google grant expires in ${Math.round(hoursUntilGrantExpiry)} hours. Please reconnect soon.`,
        };
      }

      if (!tokenDoc.webhookExpiration) {
        // In local development, webhooks require HTTPS and won't work
        // Calendar is still "connected" (tokens exist), just without real-time sync
        return {
          connected: true,
          needsReconnection: false,
          message: 'Connected (webhooks require HTTPS for real-time sync)',
        };
      }
      const expiration = new Date(tokenDoc.webhookExpiration);
      const hoursUntilExpiration = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Check if expired or expiring within 24 hours
      const needsReconnection = hoursUntilExpiration <= 24;

      return {
        connected: hoursUntilExpiration > 0,
        expiresIn: Math.max(0, Math.round(hoursUntilExpiration)),
        expiration,
        needsReconnection,
        message: needsReconnection
          ? hoursUntilExpiration <= 0
            ? 'Webhook subscription expired'
            : `Webhook expires in ${Math.round(hoursUntilExpiration)} hours`
          : 'Webhook subscription active',
      };
    } catch (error) {
      this.logger.error('Error checking connection status:', error);
      return {
        connected: false,
        needsReconnection: true,
        message: 'Error checking status',
      };
    }
  }
}
