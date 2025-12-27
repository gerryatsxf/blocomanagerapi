import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendNotificationRequestDto } from './dto/send-notification-request.dto';
import { NylasService } from '../nylas/nylas.service';
import { google } from 'googleapis';

@Injectable()
export class NotificationService {
  private gmail;
  private oauth2Client;

  constructor(
    private configService: ConfigService,
    private nylasService: NylasService,
  ) {
    // Initialize Google OAuth2 client for Gmail API
    this.initializeGoogleAuth();
  }

  /**
   * Initialize Google OAuth2 client
   */
  private initializeGoogleAuth() {
    try {
      const clientId = this.configService.get<string>('GOOGLE_EMAIL_CLIENT_ID');
      const clientSecret = this.configService.get<string>('GOOGLE_EMAIL_CLIENT_SECRET');
      const redirectUri = this.configService.get<string>('GOOGLE_EMAIL_REDIRECT_URI');
      const refreshToken = this.configService.get<string>('GOOGLE_EMAIL_REFRESH_TOKEN');

      if (!clientId || !clientSecret) {
        console.warn('⚠️  Google OAuth credentials not configured. Email sending will use console logging only.');
        console.warn('   See GMAIL_SETUP.md for configuration instructions.');
        return;
      }

      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri,
      );

      if (refreshToken) {
        // Set the refresh token - Google will automatically refresh access tokens
        this.oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });
        
        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
        
        console.log('✅ Google Gmail API initialized successfully');
        console.log('   Email notifications will be sent via Gmail API');
      } else {
        console.warn('⚠️  GOOGLE_EMAIL_REFRESH_TOKEN not configured.');
        console.warn('   Run: node scripts/generate-gmail-token.js');
        console.warn('   Email sending will use console logging until configured.');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Google Gmail API:', error.message);
      console.error('   Email sending will fall back to console logging.');
    }
  }

  async sendNotification(
    notificationRequest: SendNotificationRequestDto,
    meeting: any,
  ) {
    console.log('meeting', meeting);
    console.log('notificationRequest', notificationRequest);
    // For now, using a simple object structure instead of Draft class
    const draftData = {
      subject: `¡Hola, ${notificationRequest.guestName}! Gracias por agendar`,
      body: `
        Hola, ${notificationRequest.guestName}
        \n<br>
        \n<br> Nos da mucho gusto saludarte. 
        \n<br>
        \n<br> Te damos una cálido bienvenida de parte de blocomanager.com :) 
        \n<br> Has agendado una sesión de reunión para el XX de XX del XXXX a las XX:XX pm. 
        \n<br> Más abajo te compartimos el link de la reunión. 
        \n<br> Te esperamos! 
        \n<br>
        \n<br> Link de videollamada: ${meeting._links.guest_url.href}
        \n<br>
        \n<br> Atentamente, 
        \n<br> blocomanager.com`,
      to: [
        {
          name: notificationRequest.guestName,
          email: notificationRequest.email,
        },
      ],
    };
    // TODO: Implement this with the new Nylas API for sending emails
    console.log('Draft data ready:', draftData);
    return draftData;
  }

  /**
   * Send email using Gmail API
   * @private
   */
  private async sendGmailEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody: string,
  ): Promise<boolean> {
    try {
      if (!this.gmail || !this.oauth2Client) {
        console.warn('Gmail API not configured, falling back to console logging');
        return false;
      }

      // Create email in RFC 2822 format
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        htmlBody,
      ];
      const message = messageParts.join('\n');

      // Encode message in base64url format
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send email
      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log(`✅ Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error('Failed to send email via Gmail API:', error.message);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName?: string,
  ): Promise<void> {
    // Get frontend URL from config
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const displayName = userName || 'there';

    const subject = 'Reset Your Password - BlocoManager';
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hi ${displayName},</p>
      
      <p>We received a request to reset your password for your BlocoManager account.</p>
      
      <p>Click the button below to choose a new password:</p>
      
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px;">
        ${resetUrl}
      </p>
      
      <div class="warning">
        <strong>⏰ This link will expire in 1 hour.</strong>
      </div>
      
      <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
      
      <p>Best regards,<br>The BlocoManager Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} BlocoManager. All rights reserved.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Hi ${displayName},

We received a request to reset your password for your BlocoManager account.

Click the link below to choose a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
The BlocoManager Team
    `;

    // Try to send via Gmail API
    const sent = await this.sendGmailEmail(email, subject, htmlBody, textBody);

    // If Gmail API fails, fall back to console logging
    if (!sent) {
      console.log('='.repeat(80));
      console.log('PASSWORD RESET EMAIL (Console Fallback)');
      console.log('='.repeat(80));
      console.log(`To: ${email}`);
      console.log(`Name: ${displayName}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log(`Token: ${resetToken}`);
      console.log(`Expires: 1 hour from now`);
      console.log('='.repeat(80));
      console.log('Email Body:');
      console.log('-'.repeat(80));
      console.log(textBody);
      console.log('='.repeat(80));
    }
  }

  /**
   * Send password change verification email (for authenticated users)
   */
  async sendChangePasswordEmail(
    email: string,
    changeToken: string,
    userName?: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    const changeUrl = `${frontendUrl}/change-password?token=${changeToken}`;
    const displayName = userName || 'there';
    const subject = 'Verify Your Password Change - BlocoManager';
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
    .alert { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Change Request</h1>
    </div>
    <div class="content">
      <p>Hi ${displayName},</p>
      <p>You requested to change your password for your BlocoManager account.</p>
      <p>To confirm this change and set your new password, click the button below:</p>
      <p style="text-align: center;">
        <a href="${changeUrl}" class="button">Change My Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px;">${changeUrl}</p>
      <div class="warning"><strong>⏰ This link will expire in 1 hour.</strong></div>
      <div class="alert">
        <strong>⚠️ Didn't request this change?</strong><br>
        If you didn't request a password change, please ignore this email and contact support immediately.
      </div>
      <p>Best regards,<br>The BlocoManager Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} BlocoManager. All rights reserved.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

    const textBody = `Hi ${displayName},

You requested to change your password for your BlocoManager account.

To confirm this change and set your new password, click the link below:
${changeUrl}

⏰ This link will expire in 1 hour.

⚠️ IMPORTANT: If you didn't request this change, please ignore this email and contact support immediately.

Best regards,
The BlocoManager Team`;

    const sent = await this.sendGmailEmail(email, subject, htmlBody, textBody);

    if (!sent) {
      console.log('='.repeat(80));
      console.log('📧 CHANGE PASSWORD EMAIL (Console Fallback)');
      console.log('='.repeat(80));
      console.log(`To: ${email}`);
      console.log(`Subject: ${subject}`);
      console.log(`Change URL: ${changeUrl}`);
      console.log('='.repeat(80));
    }
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmation(
    email: string,
    userName?: string,
  ): Promise<void> {
    const displayName = userName || 'there';
    const subject = 'Password Reset Successful - BlocoManager';
    
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .success { background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    .alert { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Password Changed</h1>
    </div>
    <div class="content">
      <p>Hi ${displayName},</p>
      
      <div class="success">
        <strong>Your password was successfully reset on ${new Date().toLocaleString('en-US', { 
          dateStyle: 'full', 
          timeStyle: 'short' 
        })}.</strong>
      </div>
      
      <p>Your BlocoManager account is now secured with your new password.</p>
      
      <div class="alert">
        <strong>⚠️ Didn't make this change?</strong><br>
        If you didn't reset your password, please contact our support team immediately at support@blocomanager.com
      </div>
      
      <p>Best regards,<br>The BlocoManager Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} BlocoManager. All rights reserved.</p>
      <p>This is an automated message, please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Hi ${displayName},

Your password was successfully reset on ${new Date().toLocaleString()}.

Your BlocoManager account is now secured with your new password.

⚠️ IMPORTANT: If you didn't make this change, please contact support immediately at support@blocomanager.com

Best regards,
The BlocoManager Team
    `;

    // Try to send via Gmail API
    const sent = await this.sendGmailEmail(email, subject, htmlBody, textBody);

    // If Gmail API fails, fall back to console logging
    if (!sent) {
      console.log('='.repeat(80));
      console.log('PASSWORD RESET CONFIRMATION (Console Fallback)');
      console.log('='.repeat(80));
      console.log(`To: ${email}`);
      console.log(`Name: ${displayName}`);
      console.log('='.repeat(80));
      console.log(textBody);
      console.log('='.repeat(80));
    }
  }

  /**
   * Send welcome email to new user with email verification link
   */
  async sendWelcomeEmail(
    email: string,
    verificationToken: string,
    firstName?: string,
    lastName?: string,
  ): Promise<void> {
    const displayName = firstName || 'there';
    const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || 'there';
    const subject = 'Welcome to BlocoManager! Please Verify Your Email 🎉';
    
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 32px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .welcome-box { background-color: #e8f5e9; border-left: 4px solid #4CAF50; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .verify-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; padding: 14px 28px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; font-weight: bold; }
    .button-primary { background-color: #2196F3; }
    .features { background-color: white; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .feature-item { margin: 15px 0; padding-left: 30px; position: relative; }
    .feature-item:before { content: "✓"; position: absolute; left: 0; color: #4CAF50; font-weight: bold; font-size: 20px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    .social { margin: 20px 0; }
    .social a { color: #4CAF50; text-decoration: none; margin: 0 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to BlocoManager!</h1>
    </div>
    <div class="content">
      <p style="font-size: 18px;">Hi ${displayName},</p>
      
      <div class="welcome-box">
        <h2 style="margin-top: 0; color: #2e7d32;">Thank you for joining BlocoManager!</h2>
        <p style="margin-bottom: 0;">We're excited to have you on board. Your account has been successfully created!</p>
      </div>
      
      <div class="verify-box">
        <h3 style="margin-top: 0; color: #f57c00;">📧 Please Verify Your Email Address</h3>
        <p>To activate your account and access all features, please verify your email address by clicking the button below:</p>
        <p style="text-align: center;">
          <a href="${verificationUrl}" class="button button-primary">Verify Email Address</a>
        </p>
        <p style="font-size: 13px; color: #666;">Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px; font-size: 12px;">
          ${verificationUrl}
        </p>
      </div>
      
      <p>BlocoManager is your all-in-one solution for scheduling, managing, and optimizing your meeting workflow.</p>
      
      <div class="features">
        <h3 style="margin-top: 0; color: #2e7d32;">What You Can Do:</h3>
        <div class="feature-item">
          <strong>Smart Scheduling</strong> - Effortlessly book and manage appointments
        </div>
        <div class="feature-item">
          <strong>Calendar Integration</strong> - Sync with your existing calendars
        </div>
        <div class="feature-item">
          <strong>Team Collaboration</strong> - Coordinate meetings with your team
        </div>
        <div class="feature-item">
          <strong>Automated Reminders</strong> - Never miss an important meeting
        </div>
        <div class="feature-item">
          <strong>Analytics & Insights</strong> - Track your scheduling metrics
        </div>
      </div>
      
      <p>If you have any questions or need assistance, our support team is here to help. Just reply to this email or visit our help center.</p>
      
      <p>Best regards,<br>
      <strong>The BlocoManager Team</strong></p>
      
      <div class="social">
        <p style="text-align: center; color: #666;">
          Follow us: 
          <a href="#">Twitter</a> | 
          <a href="#">LinkedIn</a> | 
          <a href="#">Facebook</a>
        </p>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} BlocoManager. All rights reserved.</p>
      <p>You're receiving this email because you created an account at BlocoManager.</p>
      <p style="margin-top: 10px;">
        <a href="${frontendUrl}/settings" style="color: #666;">Account Settings</a> | 
        <a href="${frontendUrl}/help" style="color: #666;">Help Center</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Welcome to BlocoManager! 🎉

Hi ${displayName},

Thank you for joining BlocoManager!

We're excited to have you on board. Your account has been successfully created!

📧 IMPORTANT: Please Verify Your Email Address

To activate your account and access all features, please verify your email address by clicking this link:

${verificationUrl}

---

BlocoManager is your all-in-one solution for scheduling, managing, and optimizing your meeting workflow.

What You Can Do:
✓ Smart Scheduling - Effortlessly book and manage appointments
✓ Calendar Integration - Sync with your existing calendars
✓ Team Collaboration - Coordinate meetings with your team
✓ Automated Reminders - Never miss an important meeting
✓ Analytics & Insights - Track your scheduling metrics

If you have any questions or need assistance, our support team is here to help. Just reply to this email or visit our help center.

Best regards,
The BlocoManager Team

---
© ${new Date().getFullYear()} BlocoManager. All rights reserved.
You're receiving this email because you created an account at BlocoManager.

Account Settings: ${frontendUrl}/settings
Help Center: ${frontendUrl}/help
    `;

    // Try to send via Gmail API
    const sent = await this.sendGmailEmail(email, subject, htmlBody, textBody);

    // If Gmail API fails, fall back to console logging
    if (!sent) {
      console.log('='.repeat(80));
      console.log('WELCOME EMAIL WITH VERIFICATION (Console Fallback)');
      console.log('='.repeat(80));
      console.log(`To: ${email}`);
      console.log(`Name: ${fullName}`);
      console.log(`Verification URL: ${verificationUrl}`);
      console.log('='.repeat(80));
      console.log(textBody);
      console.log('='.repeat(80));
    }
  }

  /**
   * Send email change verification to CURRENT email (Step 1)
   */
  async sendCurrentEmailVerification(
    email: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const verificationUrl = `${frontendUrl}/change-email?token=${token}`;

    const subject = 'Verify Your Current Email - BlocoManager';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Email Change Request</h1>
    </div>
    <div class="content">
      <p>Hi ${fullName},</p>
      
      <p>We received a request to change the email address associated with your BlocoManager account.</p>
      
      <div class="warning">
        <strong>⚠️ Security Check Required</strong><br>
        To proceed with changing your email address, we need to verify that you have access to your current email inbox.
      </div>
      
      <p>Click the button below to verify your current email and proceed to step 2:</p>
      
      <a href="${verificationUrl}" class="button">Verify Current Email</a>
      
      <p><small>Or copy this link into your browser:<br>${verificationUrl}</small></p>
      
      <p><strong>Important:</strong></p>
      <ul>
        <li>This link expires in 1 hour</li>
        <li>After verification, you'll be able to enter your new email address</li>
        <li>If you didn't request this change, please ignore this email and secure your account</li>
      </ul>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} BlocoManager. All rights reserved.</p>
        <p>Need help? Contact our support team.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Email Change Request - BlocoManager

Hi ${fullName},

We received a request to change the email address associated with your BlocoManager account.

SECURITY CHECK REQUIRED:
To proceed with changing your email address, we need to verify that you have access to your current email inbox.

Click this link to verify your current email and proceed to step 2:
${verificationUrl}

IMPORTANT:
• This link expires in 1 hour
• After verification, you'll be able to enter your new email address
• If you didn't request this change, please ignore this email and secure your account

---
© ${new Date().getFullYear()} BlocoManager. All rights reserved.
Need help? Contact our support team.
    `;

    const sent = await this.sendGmailEmail(email, subject, htmlBody, textBody);

    if (!sent) {
      console.log('='.repeat(80));
      console.log('EMAIL CHANGE - CURRENT EMAIL VERIFICATION (Console Fallback)');
      console.log('='.repeat(80));
      console.log(`To: ${email}`);
      console.log(`Name: ${fullName}`);
      console.log(`Verification URL: ${verificationUrl}`);
      console.log('='.repeat(80));
      console.log(textBody);
      console.log('='.repeat(80));
    }
  }

  /**
   * Send email change verification to NEW email (Step 2)
   */
  async sendNewEmailVerification(
    newEmail: string,
    fullName: string,
    currentEmail: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const confirmationUrl = `${frontendUrl}/confirm-email-change?token=${token}`;

    const subject = 'Confirm Your New Email Address - BlocoManager';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 15px 30px; background: #28a745; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .info-box { background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✉️ Confirm Your New Email</h1>
    </div>
    <div class="content">
      <p>Hi ${fullName},</p>
      
      <p>You're almost done! This is the final step to change your BlocoManager account email address.</p>
      
      <div class="info-box">
        <strong>📧 Email Change Details:</strong><br>
        From: ${currentEmail}<br>
        To: <strong>${newEmail}</strong>
      </div>
      
      <p>Click the button below to confirm this email address and complete the change:</p>
      
      <a href="${confirmationUrl}" class="button">Confirm New Email Address</a>
      
      <p><small>Or copy this link into your browser:<br>${confirmationUrl}</small></p>
      
      <p><strong>What happens next:</strong></p>
      <ul>
        <li>Your account email will be updated to ${newEmail}</li>
        <li>Future login and communications will use this new email</li>
        <li>Your password and other account settings remain unchanged</li>
      </ul>
      
      <p><strong>Security Note:</strong> If you didn't request this email change, please ignore this message. The change will not take effect unless you click the confirmation button above.</p>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} BlocoManager. All rights reserved.</p>
        <p>Need help? Contact our support team.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Confirm Your New Email Address - BlocoManager

Hi ${fullName},

You're almost done! This is the final step to change your BlocoManager account email address.

EMAIL CHANGE DETAILS:
From: ${currentEmail}
To: ${newEmail}

Click this link to confirm your new email address and complete the change:
${confirmationUrl}

WHAT HAPPENS NEXT:
• Your account email will be updated to ${newEmail}
• Future login and communications will use this new email
• Your password and other account settings remain unchanged

SECURITY NOTE: If you didn't request this email change, please ignore this message. The change will not take effect unless you click the confirmation link above.

---
© ${new Date().getFullYear()} BlocoManager. All rights reserved.
Need help? Contact our support team.
    `;

    const sent = await this.sendGmailEmail(newEmail, subject, htmlBody, textBody);

    if (!sent) {
      console.log('='.repeat(80));
      console.log('EMAIL CHANGE - NEW EMAIL VERIFICATION (Console Fallback)');
      console.log('='.repeat(80));
      console.log(`To: ${newEmail}`);
      console.log(`Name: ${fullName}`);
      console.log(`From: ${currentEmail}`);
      console.log(`Confirmation URL: ${confirmationUrl}`);
      console.log('='.repeat(80));
      console.log(textBody);
      console.log('='.repeat(80));
    }
  }

  /**
   * Send confirmation email after successful email change
   */
  async sendEmailChangeConfirmation(
    newEmail: string,
    fullName: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const loginUrl = `${frontendUrl}/login`;

    const subject = 'Email Address Successfully Changed - BlocoManager';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Email Change Complete</h1>
    </div>
    <div class="content">
      <p>Hi ${fullName},</p>
      
      <div class="success-box">
        <strong>🎉 Success!</strong><br>
        Your BlocoManager account email has been successfully changed to:<br>
        <strong>${newEmail}</strong>
      </div>
      
      <p><strong>What's Changed:</strong></p>
      <ul>
        <li>Use <strong>${newEmail}</strong> to log in from now on</li>
        <li>All future notifications will be sent to this email</li>
        <li>Your password remains the same</li>
        <li>All your data and settings are preserved</li>
      </ul>
      
      <a href="${loginUrl}" class="button">Go to Login</a>
      
      <p><strong>Security Reminder:</strong> If you didn't make this change, please contact our support team immediately.</p>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} BlocoManager. All rights reserved.</p>
        <p>Need help? Contact our support team.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
Email Address Successfully Changed - BlocoManager

Hi ${fullName},

SUCCESS! 🎉
Your BlocoManager account email has been successfully changed to:
${newEmail}

WHAT'S CHANGED:
• Use ${newEmail} to log in from now on
• All future notifications will be sent to this email
• Your password remains the same
• All your data and settings are preserved

Log in now: ${loginUrl}

SECURITY REMINDER: If you didn't make this change, please contact our support team immediately.

---
© ${new Date().getFullYear()} BlocoManager. All rights reserved.
Need help? Contact our support team.
    `;

    const sent = await this.sendGmailEmail(newEmail, subject, htmlBody, textBody);

    if (!sent) {
      console.log('='.repeat(80));
      console.log('EMAIL CHANGE CONFIRMATION (Console Fallback)');
      console.log('='.repeat(80));
      console.log(`To: ${newEmail}`);
      console.log(`Name: ${fullName}`);
      console.log('='.repeat(80));
      console.log(textBody);
      console.log('='.repeat(80));
    }
  }
}
