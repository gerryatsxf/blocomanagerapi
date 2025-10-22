import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { getTenantConfig, isEmailAuthorizedForTenant, getAuthorizedProviders } from './config/tenant-email.config';

@Injectable()
export class GoogleOAuthService {
  private oauth2Client: any;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');
    
    console.log('🔧 Google OAuth Config:', {
      clientId: clientId ? `${clientId.substring(0, 10)}...` : 'MISSING',
      clientSecret: clientSecret ? 'SET' : 'MISSING',
      redirectUri: redirectUri || 'MISSING'
    });

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );
  }

  private readonly SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  // TODO: Implement proper database storage for tenant OAuth tokens
  // For now, using in-memory storage (this should be replaced with database storage)
  // Key format: "tenantId:email" -> tokens
  private tenantTokens = new Map<string, {
    tokens: any;
    grantId?: string; // Kept for backwards compatibility
    userEmail: string;
    tenantId: string;
    // providerGrantId removed - not needed for Google Calendar API direct usage
    connectedAt: Date;
  }>();

  /**
   * Generate storage key for tenant-email combination
   */
  private getStorageKey(tenantId: string, email: string): string {
    return `${tenantId}:${email.toLowerCase()}`;
  }

  /**
   * Store OAuth tokens for a specific tenant-email combination
   */
  async storeTokensForTenant(tenantId: string, tokens: any, userEmail: string, grantId?: string) {
    const storageKey = this.getStorageKey(tenantId, userEmail);
    
    this.tenantTokens.set(storageKey, {
      tokens,
      grantId,
      userEmail,
      tenantId,
      // providerGrantId removed - not needed for Google Calendar API
      connectedAt: new Date(),
    });
    
    console.log(`🔐 Stored tokens for tenant ${tenantId} with provider ${userEmail}:`, {
      storageKey,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      usingGoogleCalendarAPI: true, // Clear indication of current approach
    });
  }

  /**
   * Get stored grant ID for a tenant (uses first authenticated provider for now)
   * NOTE: This method is kept for potential future Nylas integration but currently unused
   * We're now using Google Calendar API directly instead of Nylas
   */
  async getStoredGrantId(tenantId: string, providerEmail?: string): Promise<string | null> {
    // DEPRECATED: Using Google Calendar API directly instead of Nylas grants
    console.log(`⚠️ getStoredGrantId called but we're using Google Calendar API directly now`);
    return null;
    
    /* KEPT FOR FUTURE NYLAS INTEGRATION:
    if (providerEmail) {
      // Get grant for specific provider
      const storageKey = this.getStorageKey(tenantId, providerEmail);
      const tenantData = this.tenantTokens.get(storageKey);
      
      if (tenantData) {
        const mainGrantId = this.configService.get<string>('NYLAS_MAIN_ACCOUNT_GRANT_ID');
        console.log(`🔑 Using main grant ID for tenant ${tenantId} provider ${providerEmail}: ${mainGrantId}`);
        return mainGrantId;
      }
    } else {
      // Get grant for any authenticated provider for this tenant
      for (const [key, data] of this.tenantTokens.entries()) {
        if (data.tenantId === tenantId) {
          const mainGrantId = this.configService.get<string>('NYLAS_MAIN_ACCOUNT_GRANT_ID');
          console.log(`🔑 Using main grant ID for tenant ${tenantId} (any provider): ${mainGrantId}`);
          return mainGrantId;
        }
      }
    }
    
    return null;
    */
  }

  /**
   * Get stored tokens for a specific tenant-email combination
   */
  async getStoredTokens(tenantId: string, providerEmail?: string) {
    if (providerEmail) {
      const storageKey = this.getStorageKey(tenantId, providerEmail);
      return this.tenantTokens.get(storageKey);
    }
    
    // If no specific email provided, return first match for tenant
    for (const [key, data] of this.tenantTokens.entries()) {
      if (data.tenantId === tenantId) {
        return data;
      }
    }
    
    return null;
  }

  /**
   * Get all authenticated providers for a tenant
   */
  async getAuthenticatedProviders(tenantId: string): Promise<string[]> {
    const providers: string[] = [];
    
    for (const [key, data] of this.tenantTokens.entries()) {
      if (data.tenantId === tenantId) {
        providers.push(data.userEmail);
      }
    }
    
    return providers;
  }

  /**
   * Check if a tenant has any authenticated providers or a specific provider
   */
  async isTenantAuthenticated(tenantId: string, providerEmail?: string): Promise<{
    isAuthenticated: boolean;
    email?: string;
    authenticatedProviders?: string[];
    message: string;
  }> {
    try {
      const tenantConfig = getTenantConfig(tenantId);
      if (!tenantConfig) {
        return {
          isAuthenticated: false,
          message: `Tenant '${tenantId}' not found in configuration`,
        };
      }

      if (providerEmail) {
        // Check specific provider
        const storedTokens = await this.getStoredTokens(tenantId, providerEmail);
        if (!storedTokens) {
          return {
            isAuthenticated: false,
            message: `Provider '${providerEmail}' has not authenticated for tenant '${tenantId}'`,
          };
        }

        return {
          isAuthenticated: true,
          email: storedTokens.userEmail,
          message: `Provider '${providerEmail}' is authenticated for tenant '${tenantId}'`,
        };
      } else {
        // Check if tenant has any authenticated providers
        const authenticatedProviders = await this.getAuthenticatedProviders(tenantId);
        
        if (authenticatedProviders.length === 0) {
          return {
            isAuthenticated: false,
            authenticatedProviders: [],
            message: `No providers authenticated for tenant '${tenantId}'. Authorized providers: ${tenantConfig.authorizedProviders.join(', ')}`,
          };
        }

        return {
          isAuthenticated: true,
          authenticatedProviders,
          message: `Tenant '${tenantId}' has ${authenticatedProviders.length} authenticated provider(s): ${authenticatedProviders.join(', ')}`,
        };
      }
    } catch (error) {
      return {
        isAuthenticated: false,
        message: `Error checking authentication for tenant '${tenantId}': ${error.message}`,
      };
    }
  }

  /**
   * Generate Google OAuth authorization URL
   */
  async generateAuthUrl(tenantId: string): Promise<string> {
    console.log('🔗 Generating auth URL for tenant:', tenantId);
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      state: tenantId, // Pass tenant ID as state parameter
      prompt: 'consent', // Force consent screen to get refresh token
    });

    console.log('🔗 Generated auth URL:', authUrl);
    return authUrl;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, tenantId: string): Promise<any> {
    try {
      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get user info
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      
      const userEmail = userInfo.data.email;

      // 🔐 VALIDATION: Check if the authenticated email is authorized for this tenant
      if (!isEmailAuthorizedForTenant(tenantId, userEmail)) {
        const tenantConfig = getTenantConfig(tenantId);
        const authorizedEmails = tenantConfig?.authorizedProviders || [];
        
        throw new Error(
          `Unauthorized email for tenant '${tenantId}'. ` +
          `Email '${userEmail}' is not authorized. ` +
          `Authorized provider emails: ${authorizedEmails.join(', ')}`
        );
      }

      console.log(`✅ Email validation passed for tenant ${tenantId}: ${userEmail}`);

      // NOTE: No longer using Nylas grants - storing tokens for direct Google Calendar API usage
      console.log(`🔗 Storing Google OAuth tokens for provider ${userEmail} in tenant ${tenantId}`);

      // Store tokens securely (you'll need to implement this)
      await this.storeGoogleTokens(tenantId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        email: userEmail,
        // providerGrantId removed - not needed for Google Calendar API
      });

      return {
        email: userEmail,
        connectedAt: new Date(),
        // grantId removed - using Google Calendar API directly
      };
    } catch (error) {
      throw new Error(`Failed to handle OAuth callback: ${error.message}`);
    }
  }

  /**
   * Get Google OAuth connection status for tenant
   */
  async getConnectionStatus(tenantId: string): Promise<any> {
    try {
      // Retrieve stored tokens (you'll need to implement this)
      const storedAuth = await this.getStoredGoogleTokens(tenantId);
      
      if (!storedAuth) {
        return {
          isConnected: false,
          email: null,
        };
      }

      // Check if tokens are still valid
      const isValid = await this.validateTokens(storedAuth);

      return {
        isConnected: isValid,
        email: storedAuth.email,
        connectedAt: storedAuth.connectedAt,
      };
    } catch (error) {
      throw new Error(`Failed to get connection status: ${error.message}`);
    }
  }

  /**
   * Disconnect Google OAuth for tenant
   */
  async disconnectGoogle(tenantId: string): Promise<void> {
    try {
      // Revoke tokens and remove from storage
      const storedAuth = await this.getStoredGoogleTokens(tenantId);
      
      if (storedAuth && storedAuth.accessToken) {
        // Revoke the token with Google
        await this.oauth2Client.revokeToken(storedAuth.accessToken);
      }

      // Remove from database (you'll need to implement this)
      await this.removeStoredGoogleTokens(tenantId);
    } catch (error) {
      throw new Error(`Failed to disconnect Google account: ${error.message}`);
    }
  }

  /**
   * Get authenticated OAuth client for tenant
   */
  async getAuthenticatedClient(tenantId: string): Promise<any> {
    const storedAuth = await this.getStoredGoogleTokens(tenantId);
    
    if (!storedAuth) {
      throw new Error('Google account not connected for this tenant');
    }

    const client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );

    client.setCredentials({
      access_token: storedAuth.accessToken,
      refresh_token: storedAuth.refreshToken,
      expiry_date: storedAuth.expiryDate,
    });

    return client;
  }

  // TODO: Implement these methods with your database
  private async storeGoogleTokens(tenantId: string, tokens: any): Promise<void> {
    // Store using our new token storage system
    await this.storeTokensForTenant(tenantId, tokens, tokens.email);
    console.log(`✅ Stored Google tokens for tenant: ${tenantId}`);
  }

  private async getStoredGoogleTokens(tenantId: string): Promise<any> {
    // Retrieve using our new token storage system
    const storedData = await this.getStoredTokens(tenantId);
    if (!storedData) {
      console.log(`❌ No stored Google tokens found for tenant: ${tenantId}`);
      return null;
    }
    
    console.log(`✅ Retrieved Google tokens for tenant: ${tenantId}`);
    return {
      ...storedData.tokens,
      tenantId,
      email: storedData.userEmail,
    };
  }

  private async removeStoredGoogleTokens(tenantId: string): Promise<void> {
    // Remove using our new token storage system
    this.tenantTokens.delete(tenantId);
    console.log(`🗑️ Removed Google tokens for tenant: ${tenantId}`);
  }

  private async validateTokens(storedAuth: any): Promise<boolean> {
    try {
      // Check if token is expired and try to refresh
      const now = Date.now();
      if (storedAuth.expiryDate && storedAuth.expiryDate < now) {
        // Token is expired, try to refresh
        if (storedAuth.refreshToken) {
          const client = new google.auth.OAuth2(
            this.configService.get<string>('GOOGLE_CLIENT_ID'),
            this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
            this.configService.get<string>('GOOGLE_REDIRECT_URI'),
          );
          
          client.setCredentials({
            refresh_token: storedAuth.refreshToken,
          });

          const { credentials } = await client.refreshAccessToken();
          
          // Update stored tokens
          await this.storeGoogleTokens(storedAuth.tenantId, {
            ...storedAuth,
            accessToken: credentials.access_token,
            expiryDate: credentials.expiry_date,
          });

          return true;
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }
}