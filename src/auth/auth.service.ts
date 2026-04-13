import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from '../session/session.service';
import { TenantService } from '../tenant/tenant.service';
import { UsersService } from '../users/users.service';
import { EncryptionService } from '../encryption/encryption.service';
import { Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { ISession, TenantVisitorStatus } from '../session/entities/session.interface';
import { PasswordResetService } from '../password-reset/password-reset.service';
import { NotificationService } from '../notification/notification.service';
import { ForgotPasswordDto } from '../password-reset/dto/forgot-password.dto';
import { ForgotPasswordResponseDto } from '../password-reset/dto/forgot-password-response.dto';
import { ResetPasswordDto } from '../password-reset/dto/reset-password.dto';
import { ResetPasswordResponseDto } from '../password-reset/dto/reset-password-response.dto';
import { ChangePasswordRequestResponseDto } from '../password-reset/dto/change-password-request-response.dto';
import { ChangePasswordDto } from '../password-reset/dto/change-password.dto';
import { ChangePasswordResponseDto } from '../password-reset/dto/change-password-response.dto';
import { EmailChangeService } from '../email-change/email-change.service';
import { ChangeEmailRequestResponseDto } from '../email-change/dto/change-email-request-response.dto';
import { ChangeEmailDto } from '../email-change/dto/change-email.dto';
import { ChangeEmailResponseDto } from '../email-change/dto/change-email-response.dto';
import { ConfirmEmailChangeDto } from '../email-change/dto/confirm-email-change.dto';
import { ConfirmEmailChangeResponseDto } from '../email-change/dto/confirm-email-change-response.dto';
import { RefreshSessionResponseDto } from './dto/refresh-session-response.dto';
import { PLATFORM_ID } from '../common/platform.constants';

@Injectable()
export class AuthService {
  constructor(
    private sessionService: SessionService,
    private jwtService: JwtService,
    private tenantService: TenantService,
    private usersService: UsersService,
    private encryptionService: EncryptionService,
    private passwordResetService: PasswordResetService,
    private notificationService: NotificationService,
    private emailChangeService: EmailChangeService,
  ) {}

  /**
   * Login with email and password
   * Validates credentials and converts existing visitor session to authenticated session
   * Requires an unauthenticated session token in Authorization header
   */
  async login(loginDto: LoginDto, request?: Request): Promise<LoginResponseDto> {
    // Get the session from the request (injected by JWT guard)
    const session = (request as any).user;
    
    if (!session) {
      throw new UnauthorizedException('Valid session token is required');
    }
    
    // Ensure this is an unauthenticated session
    if (session.userId) {
      throw new BadRequestException('This session is already authenticated. Please use a new session to login.');
    }

    // Find user by email
    const user = await this.usersService.findByEmail(loginDto.email);
    
    if (!user) {
      console.log(`[AUTH] Login attempt FAILED | Email: ${loginDto.email} | Reason: User not found | Timestamp: ${new Date().toISOString()}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await this.encryptionService.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      console.log(`[AUTH] Login attempt FAILED | Email: ${loginDto.email} | Reason: Invalid password | Timestamp: ${new Date().toISOString()}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update the existing session with userId to make it authenticated
    const authenticatedSession = await this.sessionService.update(session._id, {
      userId: user._id.toString(),
      tenantVisitorStatus: TenantVisitorStatus.AUTHENTICATED,
    });

    console.log(`[AUTH] Login attempt SUCCESS | Email: ${loginDto.email} | User ID: ${user._id} | Timestamp: ${new Date().toISOString()}`);

    // Generate new JWT token for the authenticated session
    return {
      access_token: this.jwtService.sign({
        id: authenticatedSession.id,
      }),
    };
  }

  async createToken(request?: Request): Promise<any> {
    // Extract tenant from request if provided, otherwise use default
    let tenant = PLATFORM_ID; // default platform tenant
    if (request) {
      tenant = this.tenantService.extractTenantFromRequest(request);
      console.log(`Creating session for tenant: ${tenant} from host: ${request.get('host')}`);
    }
    
    const session = await this.sessionService.create(tenant);
    return {
      access_token: this.jwtService.sign({
        id: session.id,
      }),
    };
  }

  async deleteToken(leadId: string): Promise<any> {
    // Logic to delete the token or session
    // This could involve invalidating the JWT or removing the session from the database
    const session = await this.sessionService.findByLeadId(leadId);
    console.log({session})
    const udpated = await this.sessionService.update(session.id, { 
      tenantVisitorStatus: TenantVisitorStatus.PROCESSED, 
      leadId: `${session.leadId}_stale` 
    });
    console.log({ udpated });
    return { message: 'Session deleted successfully' };
  }

  /**
   * Authenticate an existing session by associating it with a user
   * This converts a visitor/unauthenticated session into an authenticated session
   */
  async authenticateSession(sessionId: string, userId: string): Promise<any> {
    // Update the session with the userId
    const updatedSession = await this.sessionService.update(sessionId, { 
      userId,
      tenantVisitorStatus: TenantVisitorStatus.AUTHENTICATED
    });
    
    // Return a new token with the updated session
    return {
      access_token: this.jwtService.sign({
        id: updatedSession.id,
      }),
    };
  }

  /**
   * Logout by revoking the current session and creating a new unauthenticated session
   * Returns a new token for tracking visitor activity after logout
   */
  async logout(session: ISession, request?: Request): Promise<LogoutResponseDto> {
    if (!session || !session._id) {
      throw new UnauthorizedException('Invalid session');
    }

    // Revoke the current session
    await this.sessionService.revokeSession(session._id);

    // Create a new unauthenticated session for the visitor
    const tenant = session.tenant || PLATFORM_ID; // Use same tenant
    const newSession = await this.sessionService.create(tenant);

    // Return new JWT token for the unauthenticated session
    return {
      access_token: this.jwtService.sign({
        id: newSession.id,
      }),
    };
  }

  /**
   * Refresh session - Extend session duration before expiration
   * Allows users to stay logged in without interruption during active use
   */
  async refreshSession(session: ISession): Promise<RefreshSessionResponseDto> {
    if (!session || !session._id) {
      throw new UnauthorizedException('Invalid session');
    }

    // Check if session is already expired
    const now = Date.now();
    const expirationTime = session.timestamp + session.duration;
    
    if (now > expirationTime) {
      throw new UnauthorizedException('Session has expired. Please login again.');
    }

    // Update session with new timestamp (extends duration by another full period)
    const newTimestamp = Date.now();
    const updatedSession = await this.sessionService.update(session._id, {
      timestamp: newTimestamp,
    });

    // Calculate new expiration time
    const newExpiresAt = newTimestamp + updatedSession.duration;

    return {
      success: true,
      expiresAt: newExpiresAt,
      message: 'Session refreshed successfully',
    };
  }

  /**
   * Forgot password - Request password reset
   */
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
    request?: Request,
  ): Promise<ForgotPasswordResponseDto> {
    const { email } = forgotPasswordDto;

    // Find user by email
    const user = await this.usersService.findByEmail(email);

    // Always return success for security (prevent email enumeration)
    const response: ForgotPasswordResponseDto = {
      success: true,
      message: 'If the email exists, a password reset link has been sent',
    };

    // If user doesn't exist, still return success but don't send email
    if (!user) {
      // Log for monitoring (optional)
      console.log(`Password reset attempted for non-existent email: ${email}`);
      return response;
    }

    try {
      // Extract IP and user agent for audit trail
      const ipAddress = request?.ip || request?.socket?.remoteAddress;
      const userAgent = request?.get('user-agent');

      // Create reset token
      const resetToken = await this.passwordResetService.createResetToken(
        user._id.toString(),
        ipAddress,
        userAgent,
      );

      // Send email with reset link
      await this.notificationService.sendPasswordResetEmail(
        email,
        resetToken,
        user.firstName,
      );

      console.log(`Password reset email sent to: ${email}`);
    } catch (error) {
      // Log error but still return success (don't expose errors to user)
      console.error('Error sending password reset email:', error);
    }

    return response;
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    const { token, newPassword } = resetPasswordDto;

    // Find and validate token
    const passwordReset = await this.passwordResetService.findValidToken(token);

    if (!passwordReset) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Find user
    const user = await this.usersService.findById(passwordReset.userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash new password
    const hashedPassword = await this.encryptionService.hash(newPassword);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Mark token as used
    await this.passwordResetService.markTokenAsUsed(passwordReset._id);

    // TODO: Optional security enhancement - Revoke all existing sessions
    // This would force re-login on all devices after password reset
    // Requires implementing sessionService.findByUserId() method

    // Send confirmation email
    await this.notificationService.sendPasswordResetConfirmation(
      user.email,
      user.firstName,
    );

    console.log(`Password reset successful for user: ${user.email}`);

    // Return success response without access token (user must login manually)
    return {
      success: true,
      message: 'Your password has been reset successfully. Please log in with your new password.',
    };
  }

  /**
   * Request password change (for authenticated users)
   */
  async changePasswordRequest(
    request: Request,
  ): Promise<ChangePasswordRequestResponseDto> {
    // Get authenticated session
    const session = (request as any).user;
    
    if (!session || !session.userId) {
      throw new UnauthorizedException('You must be logged in to change your password');
    }

    // Find user
    const user = await this.usersService.findById(session.userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    try {
      // Extract IP and user agent for audit trail
      const ipAddress = request?.ip || request?.socket?.remoteAddress;
      const userAgent = request?.get('user-agent');

      // Create change password token
      const changeToken = await this.passwordResetService.createChangePasswordToken(
        user._id.toString(),
        ipAddress,
        userAgent,
      );

      // Send email with verification link
      await this.notificationService.sendChangePasswordEmail(
        user.email,
        changeToken,
        user.firstName,
      );

      console.log(`Password change verification email sent to: ${user.email}`);

      return {
        success: true,
        message: 'A password change verification link has been sent to your email',
      };
    } catch (error) {
      console.error('Error sending change password email:', error);
      throw new BadRequestException('Failed to send verification email');
    }
  }

  /**
   * Change password with token (for authenticated users)
   */
  async changePassword(
    changePasswordDto: ChangePasswordDto,
    request: Request,
  ): Promise<ChangePasswordResponseDto> {
    const { token, newPassword } = changePasswordDto;

    // Get authenticated session
    const session = (request as any).user;
    
    if (!session || !session.userId) {
      throw new UnauthorizedException('You must be logged in to change your password');
    }

    // Find and validate token
    const passwordReset = await this.passwordResetService.findValidToken(token);

    if (!passwordReset) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Verify the token belongs to the authenticated user
    if (passwordReset.userId !== session.userId) {
      throw new UnauthorizedException('This verification token does not belong to your account');
    }

    // Find user
    const user = await this.usersService.findById(session.userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash new password
    const hashedPassword = await this.encryptionService.hash(newPassword);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Mark token as used
    await this.passwordResetService.markTokenAsUsed(passwordReset._id);

    // Send confirmation email
    await this.notificationService.sendPasswordResetConfirmation(
      user.email,
      user.firstName,
    );

    console.log(`Password changed successfully for user: ${user.email}`);

    // Return success response (user stays logged in with same session)
    return {
      success: true,
      message: 'Your password has been changed successfully',
    };
  }

  /**
   * Send welcome email to newly registered user
   */
  async sendWelcomeEmail(
    email: string,
    verificationToken: string,
    firstName?: string,
    lastName?: string,
  ): Promise<void> {
    try {
      await this.notificationService.sendWelcomeEmail(email, verificationToken, firstName, lastName);
      console.log(`✅ Welcome email with verification link sent to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send welcome email to ${email}:`, error.message);
      // Don't throw - we don't want to fail registration if email fails
    }
  }

  /**
   * Verify email using verification token
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    // Find user by verification token
    const user = await this.usersService.findByVerificationToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.emailVerified) {
      return {
        success: true,
        message: 'Email is already verified. You can log in now.',
      };
    }

    // Mark email as verified
    await this.usersService.verifyEmail(user._id.toString());

    console.log(`✅ Email verified for user: ${user.email}`);

    return {
      success: true,
      message: 'Email verified successfully! You can now access all features.',
    };
  }

  /**
   * Delete user account
   * Permanently removes a user from the system
   * @param userId - The ID of the user to delete
   * @returns The deleted user document or undefined if not found
   */
  async delete(userId: string) {
    return this.usersService.delete(userId);
  }

  /**
   * Delete account and degrade session to visitor
   * Similar to logout, but after deleting the user account
   * @param session - Current authenticated session
   * @param request - Express request object
   * @returns New unauthenticated session token
   */
  async deleteAccountAndDegradeSession(session: ISession, request?: Request): Promise<{ access_token: string }> {
    if (!session || !session._id) {
      throw new UnauthorizedException('Invalid session');
    }

    // Revoke the current session
    await this.sessionService.revokeSession(session._id);

    // Create a new unauthenticated session for the visitor
    const tenant = session.tenant || PLATFORM_ID; // Use same tenant
    const newSession = await this.sessionService.create(tenant);

    // Return new JWT token for the unauthenticated session
    return {
      access_token: this.jwtService.sign({
        id: newSession.id,
      }),
    };
  }

  /**
   * Request email change (Step 1)
   * Sends verification token to current email
   * Requires authenticated session
   */
  async changeEmailRequest(session: ISession): Promise<ChangeEmailRequestResponseDto> {
    if (!session || !session.userId) {
      throw new UnauthorizedException('You must be logged in to change your email');
    }

    // Get user's current email
    const user = await this.usersService.findById(session.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate token and create email change request
    const token = await this.emailChangeService.createChangeRequest(
      session.userId,
      user.email,
    );

    // Send verification email to current address
    await this.notificationService.sendCurrentEmailVerification(
      user.email,
      `${user.firstName} ${user.lastName}`,
      token,
    );

    console.log(`📧 Email change requested for user: ${user.email} (Step 1: Current email verification sent)`);

    // Partially mask email for security
    const maskedEmail = this.maskEmail(user.email);

    return {
      message: 'Verification email sent to your current email address. Please check your inbox.',
      sentTo: maskedEmail,
    };
  }

  /**
   * Submit new email with current email token (Step 2)
   * Validates current email token and sends verification to new email
   * Requires authenticated session
   */
  async changeEmail(
    changeEmailDto: ChangeEmailDto,
    session: ISession,
  ): Promise<ChangeEmailResponseDto> {
    if (!session || !session.userId) {
      throw new UnauthorizedException('You must be logged in to change your email');
    }

    const { token, newEmail } = changeEmailDto;

    // Validate token from current email
    const emailChange = await this.emailChangeService.findValidCurrentEmailToken(
      session.userId,
      token,
    );

    if (!emailChange) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Ensure new email is different from current
    if (newEmail.toLowerCase() === emailChange.currentEmail.toLowerCase()) {
      throw new BadRequestException('New email must be different from current email');
    }

    // Check if new email is already in use
    const existingUser = await this.usersService.findByEmail(newEmail);
    if (existingUser) {
      throw new BadRequestException('This email address is already registered');
    }

    // Check if new email is pending change for another user
    const isPending = await this.emailChangeService.isEmailPendingChange(newEmail);
    if (isPending) {
      throw new BadRequestException('This email address is already pending verification for another account');
    }

    // Get user info for email
    const user = await this.usersService.findById(session.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Update to step 2 and generate new email token
    const newEmailToken = await this.emailChangeService.updateToStepTwo(
      emailChange._id.toString(),
      newEmail,
    );

    // Send verification email to new address
    await this.notificationService.sendNewEmailVerification(
      newEmail,
      `${user.firstName} ${user.lastName}`,
      emailChange.currentEmail,
      newEmailToken,
    );

    console.log(`📧 Email change progressing: ${emailChange.currentEmail} → ${newEmail} (Step 2: New email verification sent)`);

    // Partially mask email for security
    const maskedEmail = this.maskEmail(newEmail);

    return {
      message: 'Verification email sent to your new email address. Please check the inbox to complete the change.',
      sentTo: maskedEmail,
    };
  }

  /**
   * Confirm email change with new email token (Step 3)
   * Validates new email token and completes the email change
   * Public endpoint (token-based authentication)
   */
  async confirmEmailChange(
    confirmEmailChangeDto: ConfirmEmailChangeDto,
  ): Promise<ConfirmEmailChangeResponseDto> {
    const { token } = confirmEmailChangeDto;

    // Validate token from new email
    const emailChange = await this.emailChangeService.findValidNewEmailToken(token);

    if (!emailChange) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (!emailChange.newEmail) {
      throw new BadRequestException('Invalid email change request');
    }

    // Double-check new email isn't taken (race condition protection)
    const existingUser = await this.usersService.findByEmail(emailChange.newEmail);
    if (existingUser && existingUser._id.toString() !== emailChange.userId) {
      throw new BadRequestException('This email address is no longer available');
    }

    // Update user's email
    await this.usersService.update(emailChange.userId, {
      email: emailChange.newEmail,
    });

    // Mark email change as completed
    await this.emailChangeService.completeEmailChange(emailChange._id.toString());

    // Get user info for confirmation email
    const user = await this.usersService.findById(emailChange.userId);
    if (user) {
      // Send confirmation to new email
      await this.notificationService.sendEmailChangeConfirmation(
        emailChange.newEmail,
        `${user.firstName} ${user.lastName}`,
      );
    }

    // Revoke all sessions for this user (force re-login with new email)
    await this.sessionService.revokeAllUserSessions(emailChange.userId);

    // Create a new unauthenticated visitor session
    const tenant = PLATFORM_ID; // Default platform tenant
    const newSession = await this.sessionService.create(tenant);

    // Generate JWT token for the new visitor session
    const access_token = this.jwtService.sign({
      id: newSession.id,
    });

    console.log(`✅ Email change completed: ${emailChange.currentEmail} → ${emailChange.newEmail} (All sessions revoked, new visitor session created)`);

    return {
      success: true,
      message: 'Email address successfully changed. Please log in with your new email.',
      newEmail: emailChange.newEmail,
      access_token,
    };
  }

  /**
   * Get the authenticated user's profile from the session
   * Used by GET /auth/me
   */
  async getProfile(session: ISession): Promise<{
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    tenant?: string;
    companyName?: string;
    emailVerified: boolean;
  } | null> {
    if (!session || !session.userId) {
      return null;
    }

    const user = await this.usersService.findById(session.userId);
    if (!user) return null;

    // Update lastLoginAt (fire-and-forget)
    this.usersService.update(user._id.toString(), { lastLoginAt: new Date() }).catch(() => {});

    return {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenant: user.tenant,
      companyName: user.companyName,
      emailVerified: user.emailVerified,
    };
  }

  /**
   * Deferred tenant creation: create tenant + onboard to Stripe
   * Called after user is already registered and authenticated.
   * The user picks a plan on the Onboarding page, which calls POST /auth/onboard-tenant.
   */
  async onboardTenantDeferred(
    session: ISession,
    params: {
      name: string;
      description: string;
      domain?: string;
      planSlug?: string;
    },
  ): Promise<{ tenantId: string }> {
    if (!session || !session.userId) {
      throw new UnauthorizedException('You must be logged in to create a tenant');
    }

    const user = await this.usersService.findById(session.userId);
    if (!user) throw new BadRequestException('User not found');

    // Prevent double-onboard
    if (user.tenant) {
      throw new BadRequestException('You already have a tenant. Visit billing to manage your subscription.');
    }

    if (!params.name?.trim()) {
      throw new BadRequestException('Tenant name is required');
    }
    if (!params.description?.trim()) {
      throw new BadRequestException('Tenant description is required');
    }

    // Build slug: prefer explicit domain, else slugify name
    let slug = params.domain?.trim()
      ? params.domain.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : params.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) slug = 'tenant';

    // Ensure uniqueness
    const existing = await this.tenantService.findByTenantId(slug);
    if (existing) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // 1. Create the tenant
    await this.tenantService.createTenant({
      tenantId: slug,
      domain: slug,
      name: params.name.trim(),
      description: params.description.trim(),
      storageProvider: 'local',
    });

    // 2. Link user to tenant
    await this.usersService.update(user._id.toString(), {
      tenant: slug,
      role: 'tenantAdmin',
    });

    console.log(`[AUTH] Tenant created via deferred flow: ${slug} (${params.name}) for user ${user.email}`);

    return { tenantId: slug };
  }

  /**
   * Helper: Mask email for security
   * user@example.com → u***@example.com
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}${'*'.repeat(local.length - 1)}@${domain}`;
  }
}

