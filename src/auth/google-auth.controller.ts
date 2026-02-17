import { Controller, Get, Req, Res, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { GoogleAuthService } from './google-auth.service';

@ApiTags('Google Auth')
@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  /**
   * Initiate Google OAuth login for admin or tenant panel
   * GET /auth/google/login?panel=admin|tenant
   */
  @Get('login')
  @ApiOperation({ summary: 'Start Google OAuth login flow' })
  async googleLogin(
    @Query('panel') panel: string,
    @Res() res: Response,
  ) {
    try {
      // Default to admin panel if not specified
      const targetPanel = panel === 'tenant' ? 'tenant' : 'admin';
      const authUrl = this.googleAuthService.generateAuthUrl(targetPanel);
      this.logger.debug(`Redirecting to Google OAuth for ${targetPanel} panel: ${authUrl}`);
      return res.redirect(authUrl);
    } catch (error) {
      this.logger.error(`Error initiating Google OAuth: ${error.message}`);
      throw new HttpException(
        'Failed to initiate Google login',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Handle Google OAuth callback
   * GET /auth/google/callback
   */
  @Get('callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      // Extract panel from state parameter (default to admin)
      const panel = state === 'tenant' ? 'tenant' : 'admin';
      const redirectBase = `/public/${panel}/index.html`;

      if (error) {
        this.logger.error(`Google OAuth error: ${error}`);
        return res.redirect(`${redirectBase}?error=${encodeURIComponent('Google login failed')}`);
      }

      if (!code) {
        this.logger.error('No authorization code provided');
        return res.redirect(`${redirectBase}?error=${encodeURIComponent('No authorization code')}`);
      }

      // Exchange code for tokens and create/login user
      const result = await this.googleAuthService.handleCallback(code);

      // Redirect to appropriate panel with token
      return res.redirect(`${redirectBase}?token=${result.access_token}&email=${encodeURIComponent(result.email)}`);
      
    } catch (error) {
      this.logger.error(`Error in Google callback: ${error.message}`);
      const panel = state === 'tenant' ? 'tenant' : 'admin';
      return res.redirect(`/public/${panel}/index.html?error=${encodeURIComponent(error.message)}`);
    }
  }
}
