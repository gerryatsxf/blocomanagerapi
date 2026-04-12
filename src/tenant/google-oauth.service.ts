import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthToken, GoogleOAuthTokenDocument } from './entities/google-oauth-token.entity';
import { User, UserDocument } from '../users/entities/user.entity';

@Injectable()
export class GoogleOAuthService {
  private oauth2Client: any;
  // Keep in-memory cache for quick access, but persist to DB
  private tokenCache = new Map<string, any>();

  constructor(
    private configService: ConfigService,
    @InjectModel(GoogleOAuthToken.name)
    private googleOAuthTokenModel: Model<GoogleOAuthTokenDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {
    // Use GOOGLE_EMAIL_* credentials for Gmail API access (Settings tab OAuth)
    const clientId = this.configService.get<string>('GOOGLE_EMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_EMAIL_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_EMAIL_REDIRECT_URI');
    
    console.log('🔧 Google OAuth Config (Email API):', {
      clientId: clientId ? `${clientId.substring(0, 10)}...` : 'MISSING',
      clientSecret: clientSecret ? 'SET' : 'MISSING',
      redirectUri: redirectUri || 'MISSING',
      note: 'Using GOOGLE_EMAIL_CLIENT_ID for Gmail API access'
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
    'https://www.googleapis.com/auth/gmail.send', // Required for sending emails
  ];

  /**
   * Generate storage key for tenant-email combination
   */
  private getStorageKey(tenantId: string, email: string): string {
    return `${tenantId}:${email.toLowerCase()}`;
  }

  /**
   * Store OAuth tokens for a specific tenant-email combination in MongoDB
   */
  async storeTokensForTenant(tenantId: string, tokens: any, userEmail: string, grantId?: string) {
    const storageKey = this.getStorageKey(tenantId, userEmail);

    // Enforce single Google account per tenant
    const existingTokens = await this.googleOAuthTokenModel.find({ tenantId }).exec();
    if (existingTokens.length > 0 && !existingTokens.some(t => t.userEmail === userEmail)) {
      throw new Error(
        `Tenant already has Google Calendar connected with ${existingTokens[0].userEmail}. ` +
        `Please disconnect the existing account first before connecting a different one.`
      );
    }
    
    console.log(`🔍 DEBUG - storeTokensForTenant called with:`, {
      tenantId,
      userEmail,
      storageKey,
      tokensKeys: Object.keys(tokens),
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
    });
    
    const tokenData = {
      tenantId,
      userEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      grantId,
      connectedAt: new Date(),
      lastRefreshedAt: new Date(),
    };
    
    // Save to MongoDB (upsert)
    await this.googleOAuthTokenModel.findOneAndUpdate(
      { tenantId, userEmail },
      tokenData,
      { upsert: true, new: true },
    );
    
    // Also cache in memory for quick access
    this.tokenCache.set(storageKey, {
      tokens,
      userEmail,
      tenantId,
      connectedAt: new Date(),
    });
    
    console.log(`🔐 Stored tokens for tenant ${tenantId} with provider ${userEmail} in MongoDB`);
  }

  /**
   * Get stored tokens for a specific tenant-email combination
   */
  async getStoredTokens(tenantId: string, providerEmail?: string) {
    console.log(`🔍 DEBUG - getStoredTokens called with:`, {
      tenantId,
      providerEmail,
    });

    // Try cache first
    if (providerEmail) {
      const storageKey = this.getStorageKey(tenantId, providerEmail);
      const cached = this.tokenCache.get(storageKey);
      if (cached) {
        console.log(`✅ Found in cache:`, storageKey);
        return cached;
      }
    }

    // Fetch from MongoDB
    const query: any = { tenantId };
    if (providerEmail) {
      query.userEmail = providerEmail;
    }

    const tokenDoc = await this.googleOAuthTokenModel.findOne(query).exec();
    
    if (!tokenDoc) {
      console.log(`❌ DEBUG - No tokens found in MongoDB for tenant: ${tenantId}`);
      return null;
    }

    console.log(`✅ Found tokens in MongoDB for ${tokenDoc.userEmail}`);
    
    // Build result and cache it
    const result = {
      tokens: {
        access_token: tokenDoc.accessToken,
        refresh_token: tokenDoc.refreshToken,
        expiry_date: tokenDoc.expiryDate,
        scope: tokenDoc.scope,
        token_type: tokenDoc.tokenType,
      },
      userEmail: tokenDoc.userEmail,
      tenantId: tokenDoc.tenantId,
      connectedAt: tokenDoc.connectedAt,
      grantId: tokenDoc.grantId,
    };

    // Cache it
    const storageKey = this.getStorageKey(tenantId, tokenDoc.userEmail);
    this.tokenCache.set(storageKey, result);

    return result;
  }

  /**
   * Get all authenticated providers for a tenant
   */
  async getAuthenticatedProviders(tenantId: string): Promise<string[]> {
    // Query MongoDB for all tokens for this tenant
    const tokenDocs = await this.googleOAuthTokenModel.find({ tenantId }).exec();
    return tokenDocs.map(doc => doc.userEmail);
  }

  /**
   * Find OAuth token by webhook channel ID
   */
  async findByWebhookChannel(channelId: string): Promise<GoogleOAuthToken | null> {
    return this.googleOAuthTokenModel.findOne({ webhookChannelId: channelId }).exec();
  }

  /**
   * Update webhook subscription info for a tenant
   */
  async updateWebhookSubscription(
    tenantId: string,
    userEmail: string,
    webhookChannelId: string,
    webhookResourceId: string,
    webhookExpiration: Date,
  ): Promise<void> {
    await this.googleOAuthTokenModel.findOneAndUpdate(
      { tenantId, userEmail },
      {
        $set: {
          webhookChannelId,
          webhookResourceId,
          webhookExpiration,
        },
      },
    ).exec();
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
            message: `No providers authenticated for tenant '${tenantId}'.`,
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
  async generateAuthUrl(tenantId: string, panel: string = 'tenant'): Promise<string> {
    console.log(`🔗 Generating auth URL for tenant: ${tenantId}, panel: ${panel}`);
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      state: `${tenantId}:${panel}`, // Composite state: "tenantId:panel" so callback knows where to redirect
      prompt: 'consent', // Force consent screen to get refresh token
    });

    console.log(`🔗 Generated auth URL: ${authUrl}`);
    return authUrl;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, requestedTenant: string): Promise<any> {
    try {
      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get user info
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      
      const userEmail = userInfo.data.email;

      // Query database to find which tenant(s) this email belongs to
      const users = await this.userModel.find({ 
        email: userEmail.toLowerCase() 
      }).exec();

      if (users.length === 0) {
        throw new Error(
          `Email '${userEmail}' is not registered in the system. ` +
          `Please contact your administrator to create an account.`
        );
      }

      // Get list of tenants this user belongs to
      const authorizedTenants = users
        .filter(user => user.tenant)
        .map(user => user.tenant);

      if (authorizedTenants.length === 0) {
        throw new Error(
          `Email '${userEmail}' is not associated with any tenant. ` +
          `Please contact your administrator.`
        );
      }

      // Use the requested tenant if the user belongs to it, otherwise use the first one
      let actualTenant = authorizedTenants[0];
      if (authorizedTenants.includes(requestedTenant)) {
        actualTenant = requestedTenant;
      }

      console.log(`✅ Email ${userEmail} detected for tenant: ${actualTenant} (authorized tenants: ${authorizedTenants.join(', ')})`);

      // Store tokens under the detected tenant
      console.log(`🔗 Storing Google OAuth tokens for provider ${userEmail} in tenant ${actualTenant}`);

      // Store tokens securely
      await this.storeGoogleTokens(actualTenant, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        scope: tokens.scope,
        token_type: tokens.token_type,
        email: userEmail,
      });

      return {
        email: userEmail,
        connectedAt: new Date(),
        detectedTenant: actualTenant,
        authorizedTenants: authorizedTenants,
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
          connected: false,
          email: null,
        };
      }

      // Check if tokens are still valid
      const isValid = await this.validateTokens(storedAuth);

      return {
        connected: isValid,
        email: storedAuth.email,
        connectedAt: storedAuth.connectedAt,
      };
    } catch (error) {
      console.error(`Failed to get connection status: ${error.message}`);
      return {
        connected: false,
        email: null,
      };
    }
  }

  /**
   * Disconnect Google OAuth for tenant
   */
  async disconnectGoogle(tenantId: string): Promise<void> {
    // Revoke tokens with Google (best-effort, don't block on failure)
    try {
      const storedAuth = await this.getStoredGoogleTokens(tenantId);
      if (storedAuth && storedAuth.accessToken) {
        await this.oauth2Client.revokeToken(storedAuth.accessToken);
      }
    } catch (error) {
      // Token may already be expired/revoked — that's fine, continue cleanup
      console.warn(`Token revocation failed (may already be expired): ${error.message}`);
    }

    // Always remove from database regardless of revocation result
    await this.removeStoredGoogleTokens(tenantId);
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
      this.configService.get<string>('GOOGLE_EMAIL_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_EMAIL_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_EMAIL_REDIRECT_URI'),
    );

    client.setCredentials({
      access_token: storedAuth.accessToken,
      refresh_token: storedAuth.refreshToken,
      expiry_date: storedAuth.expiryDate,
    });

    return client;
  }

  /**
   * Get authenticated Gmail API client for sending emails
   * Uses stored OAuth tokens for the tenant
   */
  async getAuthenticatedGmailClient(tenantId: string): Promise<any> {
    try {
      console.log(`🔍 [getAuthenticatedGmailClient] Fetching tokens for tenant: ${tenantId}`);
      
      const storedAuth = await this.getStoredGoogleTokens(tenantId);
      
      if (!storedAuth) {
        console.error(`❌ [getAuthenticatedGmailClient] No stored tokens found for tenant: ${tenantId}`);
        console.warn(`⚠️  No Google account connected for tenant: ${tenantId}`);
        return null;
      }

      console.log(`✅ [getAuthenticatedGmailClient] Tokens found for tenant: ${tenantId}`);
      console.log(`   Email: ${storedAuth.email}`);
      console.log(`   StoredAuth object:`, JSON.stringify(storedAuth, null, 2));

      // Create OAuth2 client with stored credentials (using email OAuth client)
      const client = new google.auth.OAuth2(
        this.configService.get<string>('GOOGLE_EMAIL_CLIENT_ID'),
        this.configService.get<string>('GOOGLE_EMAIL_CLIENT_SECRET'),
        this.configService.get<string>('GOOGLE_EMAIL_REDIRECT_URI'),
      );

      // Google OAuth2 client expects snake_case property names
      // storedAuth should already have access_token, refresh_token from getStoredTokens
      const credentials = {
        access_token: storedAuth.access_token,
        refresh_token: storedAuth.refresh_token,
        expiry_date: storedAuth.expiry_date,
      };

      console.log('🔑 [getAuthenticatedGmailClient] Credentials to set:');
      console.log('   access_token:', credentials.access_token ? `${credentials.access_token.substring(0, 30)}...` : 'NULL/UNDEFINED');
      console.log('   refresh_token:', credentials.refresh_token ? `${credentials.refresh_token.substring(0, 30)}...` : 'NULL/UNDEFINED');
      console.log('   expiry_date:', credentials.expiry_date);
      
      if (!credentials.access_token || !credentials.refresh_token) {
        console.error('❌ CRITICAL: Credentials are missing!');
        console.error('   This means tokens were not stored correctly in MongoDB');
        return null;
      }

      client.setCredentials(credentials);

      console.log('✅ [getAuthenticatedGmailClient] OAuth2 client configured, creating Gmail client...');

      // Return Gmail API client
      const gmailClient = google.gmail({ version: 'v1', auth: client });
      
      console.log('✅ [getAuthenticatedGmailClient] Gmail client created successfully');
      
      return gmailClient;
    } catch (error) {
      console.error(`❌ Failed to get Gmail client for tenant ${tenantId}:`, error.message);
      console.error('   Stack:', error.stack);
      return null;
    }
  }

  /**
   * Get all Google OAuth grants (for super admin dashboard)
   */
  async getAllGoogleGrants(): Promise<GoogleOAuthTokenDocument[]> {
    return this.googleOAuthTokenModel.find().exec();
  }

  /**
   * Delete a Google OAuth grant by ID (for super admin cleanup)
   */
  async deleteGoogleGrant(grantId: string): Promise<void> {
    const grant = await this.googleOAuthTokenModel.findById(grantId).exec();
    if (!grant) {
      throw new Error('Grant not found');
    }
    // Clear cache
    for (const [key, value] of this.tokenCache.entries()) {
      if (value.tenantId === grant.tenantId) {
        this.tokenCache.delete(key);
      }
    }
    await this.googleOAuthTokenModel.findByIdAndDelete(grantId).exec();
  }

  // TODO: Implement these methods with your database
  private async storeGoogleTokens(tenantId: string, tokens: any): Promise<void> {
    console.log(`🔍 DEBUG - storeGoogleTokens called with:`, {
      tenantId,
      email: tokens.email,
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      hasAccess_token: !!tokens.access_token,
      hasRefresh_token: !!tokens.refresh_token,
      tokensKeys: Object.keys(tokens),
    });

    // Store using our new token storage system
    await this.storeTokensForTenant(tenantId, tokens, tokens.email);
    console.log(`✅ Stored Google tokens for tenant: ${tenantId}`);
  }

  private async getStoredGoogleTokens(tenantId: string): Promise<any> {
    console.log(`🔍 [getStoredGoogleTokens] Looking for tokens for tenant: ${tenantId}`);
    
    // Retrieve using our new token storage system
    const storedData = await this.getStoredTokens(tenantId);
    if (!storedData) {
      console.error(`❌ [getStoredGoogleTokens] No stored tokens found for tenant: ${tenantId}`);
      console.error(`   → Please connect Google account in Settings tab`);
      return null;
    }
    
    console.log(`✅ [getStoredGoogleTokens] Retrieved tokens for tenant: ${tenantId}`);
    console.log(`   Email: ${storedData.userEmail}`);
    console.log(`   Tokens object keys:`, Object.keys(storedData.tokens || {}));
    
    // Return tokens in both formats for compatibility
    const result = {
      ...storedData.tokens,  // This has access_token, refresh_token (underscore)
      tenantId,
      email: storedData.userEmail,
      connectedAt: storedData.connectedAt,
    };
    
    console.log(`   Result keys:`, Object.keys(result));
    console.log(`   Has access_token: ${!!result.access_token}`);
    console.log(`   Has refresh_token: ${!!result.refresh_token}`);
    
    return result;
  }

  private async removeStoredGoogleTokens(tenantId: string): Promise<void> {
    // Remove from MongoDB
    await this.googleOAuthTokenModel.deleteMany({ tenantId }).exec();
    
    // Clear cache
    for (const [key, value] of this.tokenCache.entries()) {
      if (value.tenantId === tenantId) {
        this.tokenCache.delete(key);
      }
    }
    
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
            this.configService.get<string>('GOOGLE_EMAIL_CLIENT_ID'),
            this.configService.get<string>('GOOGLE_EMAIL_CLIENT_SECRET'),
            this.configService.get<string>('GOOGLE_EMAIL_REDIRECT_URI'),
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