import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleOAuthService {
  private oauth2Client: any;

  constructor(private configService: ConfigService) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );
  }

  private readonly SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  /**
   * Generate Google OAuth authorization URL
   */
  async generateAuthUrl(tenantId: string): Promise<string> {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      state: tenantId, // Pass tenant ID as state parameter
      prompt: 'consent', // Force consent screen to get refresh token
    });

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

      // Store tokens securely (you'll need to implement this)
      await this.storeGoogleTokens(tenantId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        email: userInfo.data.email,
      });

      return {
        email: userInfo.data.email,
        connectedAt: new Date(),
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
    // Store encrypted tokens in database
    // Implementation depends on your database schema
    console.log(`Storing Google tokens for tenant: ${tenantId}`);
  }

  private async getStoredGoogleTokens(tenantId: string): Promise<any> {
    // Retrieve and decrypt tokens from database
    // Implementation depends on your database schema
    console.log(`Getting stored Google tokens for tenant: ${tenantId}`);
    return null;
  }

  private async removeStoredGoogleTokens(tenantId: string): Promise<void> {
    // Remove tokens from database
    // Implementation depends on your database schema
    console.log(`Removing Google tokens for tenant: ${tenantId}`);
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