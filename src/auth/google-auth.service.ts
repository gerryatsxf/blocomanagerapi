import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { google } from 'googleapis';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';import { SessionService } from '../session/session.service';import * as crypto from 'crypto';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private oauth2Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
  ) {
    this.initializeOAuth();
  }

  private initializeOAuth() {
    // Use GOOGLE_CLIENT_ID (admin panel login) NOT GOOGLE_EMAIL_CLIENT_ID (email API)
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    this.logger.log(`Google OAuth initialized for admin login with redirect: ${redirectUri}`);
  }

  /**
   * Generate Google OAuth authorization URL
   * @param panel - Which panel is initiating the login ('admin' or 'tenant')
   */
  generateAuthUrl(panel: string = 'admin'): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'select_account',
      state: panel, // Pass panel as state to get it back in callback
    });
  }

  /**
   * Handle OAuth callback and create/login user
   */
  async handleCallback(code: string): Promise<{ access_token: string; email: string; role: UserRole }> {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get user info from Google
      const oauth2 = google.oauth2({
        auth: this.oauth2Client,
        version: 'v2',
      });

      const { data } = await oauth2.userinfo.get();
      
      if (!data.email) {
        throw new UnauthorizedException('Could not retrieve email from Google');
      }

      this.logger.log(`Google login attempt for email: ${data.email}`);

      // Check if user exists
      let user = await this.usersService.findByEmail(data.email);
      
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
      const isSuperAdmin = data.email === adminEmail;

      if (!user) {
        // Create new user
        this.logger.log(`Creating new user for: ${data.email}`);
        
        // Generate random password (user won't need it since they login with Google)
        const randomPassword = crypto.randomBytes(32).toString('hex');
        
        user = await this.usersService.create(
          data.email,
          randomPassword,
          null, // dateOfBirth
          data.given_name || '',
          data.family_name || '',
        );

        // Mark email as verified (Google already verified it)
        await this.usersService.verifyEmail(user._id.toString());

        // If this is the admin email, grant super admin role
        if (isSuperAdmin) {
          this.logger.log(`Granting super admin role to: ${data.email}`);
          const updatedUser = await this.usersService.findByEmail(data.email);
          if (updatedUser) {
            (updatedUser as any).role = UserRole.SUPER_ADMIN;
            await updatedUser.save();
            user = updatedUser;
            this.logger.log(`User role updated: ${(user as any).role}`);
          }
        } else {
          // Refetch to get the verified user
          user = await this.usersService.findByEmail(data.email);
        }
      } else {
        this.logger.log(`Existing user logging in: ${data.email}, current role: ${(user as any).role}`);
        
        // If user exists and is the admin email, ensure they have super admin role
        if (isSuperAdmin && (user as any).role !== UserRole.SUPER_ADMIN) {
          this.logger.log(`Upgrading ${data.email} to super admin`);
          (user as any).role = UserRole.SUPER_ADMIN;
          await user.save();
          this.logger.log(`User role upgraded: ${(user as any).role}`);
        }
      }

      this.logger.log(`Final user state - email: ${user.email}, role: ${(user as any).role}, tenant: ${(user as any).tenant}, id: ${user._id}`);

      // Generate JWT token
      // Create a session for this user
      const userTenant = (user as any).tenant || 'blocomanager';
      const session = await this.sessionService.create(userTenant);
      
      // Update session with userId and mark as authenticated
      await this.sessionService.update(session._id.toString(), {
        userId: user._id.toString(),
        tenantVisitorStatus: 'authenticated' as any,
      });
      
      const payload = {
        id: session._id.toString(), // Session ID is what JwtStrategy expects
        email: user.email,
        sub: user._id,
        role: (user as any).role || UserRole.USER,
      };

      this.logger.log(`Generating JWT for user: ${user.email}, role: ${payload.role}, tenant: ${userTenant}, session: ${session._id}`);
      const access_token = this.jwtService.sign(payload);

      return {
        access_token,
        email: user.email,
        role: (user as any).role || UserRole.USER,
      };

    } catch (error) {
      this.logger.error(`Google OAuth error: ${error.message}`);
      throw new UnauthorizedException('Google authentication failed');
    }
  }
}
