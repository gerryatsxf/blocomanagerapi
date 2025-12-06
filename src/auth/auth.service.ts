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
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await this.encryptionService.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update the existing session with userId to make it authenticated
    const authenticatedSession = await this.sessionService.update(session._id, {
      userId: user._id.toString(),
      tenantVisitorStatus: TenantVisitorStatus.AUTHENTICATED,
    });

    // Generate new JWT token for the authenticated session
    return {
      access_token: this.jwtService.sign({
        id: authenticatedSession.id,
      }),
    };
  }

  async createToken(request?: Request): Promise<any> {
    // Extract tenant from request if provided, otherwise use default
    let tenant = 'blocomanager'; // default tenant
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
   * This converts an anonymous session into an authenticated session
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
    const tenant = session.tenant || 'blocomanager'; // Use same tenant
    const newSession = await this.sessionService.create(tenant);

    // Return new JWT token for the unauthenticated session
    return {
      access_token: this.jwtService.sign({
        id: newSession.id,
      }),
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

    // Return success response
    return {
      success: true,
      message: 'Password has been reset successfully',
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
    const tenant = session.tenant || 'blocomanager'; // Use same tenant
    const newSession = await this.sessionService.create(tenant);

    // Return new JWT token for the unauthenticated session
    return {
      access_token: this.jwtService.sign({
        id: newSession.id,
      }),
    };
  }
}
