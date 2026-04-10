import { Controller, Request, Post, UseGuards, Body, Delete, Param, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserCredentialsDto } from './dto/user-credential.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { UserRegistrationDto } from './dto/user-registration.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { ForgotPasswordDto } from '../password-reset/dto/forgot-password.dto';
import { ForgotPasswordResponseDto } from '../password-reset/dto/forgot-password-response.dto';
import { ResetPasswordDto } from '../password-reset/dto/reset-password.dto';
import { ResetPasswordResponseDto } from '../password-reset/dto/reset-password-response.dto';
import { ChangePasswordRequestResponseDto } from '../password-reset/dto/change-password-request-response.dto';
import { ChangePasswordDto } from '../password-reset/dto/change-password.dto';
import { ChangePasswordResponseDto } from '../password-reset/dto/change-password-response.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyEmailResponseDto } from './dto/verify-email-response.dto';
import { ChangeEmailRequestResponseDto } from '../email-change/dto/change-email-request-response.dto';
import { ChangeEmailDto } from '../email-change/dto/change-email.dto';
import { ChangeEmailResponseDto } from '../email-change/dto/change-email-response.dto';
import { ConfirmEmailChangeDto } from '../email-change/dto/confirm-email-change.dto';
import { ConfirmEmailChangeResponseDto } from '../email-change/dto/confirm-email-change-response.dto';
import { RefreshSessionResponseDto } from './dto/refresh-session-response.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('session')
  @ApiOperation({ summary: 'Create a new unauthenticated session' })
  @ApiResponse({ 
    status: 201, 
    description: 'Session created successfully - returns JWT access token for unauthenticated visitor',
    type: SessionResponseDto,
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error' 
  })
  async createSession(@Request() request): Promise<SessionResponseDto> {
    return this.authService.createToken(request);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Logout and get new unauthenticated session',
    description: `Revokes the current authenticated session and creates a new unauthenticated visitor session.
    
The old session token will be immediately invalidated and cannot be used for any further requests.

A new session token is returned to allow tracking of the visitor's unauthenticated activity after logout.

**Response:**
\`\`\`json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\`\`\`

Use the new \`access_token\` for subsequent visitor activity. The new session will be unauthenticated (no userId).`
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Successfully logged out - old session revoked and new unauthenticated session created',
    type: LogoutResponseDto,
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or expired token' 
  })
  async logout(@Request() req): Promise<LogoutResponseDto> {
    return this.authService.logout(req.user, req);
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Refresh session to extend expiration time',
    description: `Extends the current session duration by resetting the timestamp. This prevents the user from being logged out during active use.

**Use Case:** Frontend should call this endpoint periodically (e.g., every 45 minutes) while the user is actively using the application to prevent session expiration.

**How it works:**
- Validates the current session is not expired
- Resets the session timestamp to current time
- Extends session duration by another full period (1 hour)
- Returns new expiration time (no new token needed - keep using your current token)

**Example:**
- Session created at 2:00 PM, expires at 3:00 PM
- User calls /refresh at 2:50 PM
- Session now expires at 3:50 PM (new 1-hour window)
- Same JWT token continues to work

**Frontend Implementation:**
\`\`\`javascript
// Call refresh every 45 minutes (15 minutes before expiration)
setInterval(async () => {
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await response.json();
  console.log('Session extended until:', new Date(data.expiresAt));
  // Keep using the same token - no need to update it
}, 45 * 60 * 1000);
\`\`\`

**Security Note:** Works for both authenticated and visitor sessions. If session is already expired, returns 401 and user must login again.`
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Session refreshed successfully - returns new expiration time',
    schema: {
      example: {
        success: true,
        expiresAt: 1735228800000,
        message: 'Session refreshed successfully'
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Session has already expired or invalid token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Session has expired. Please login again.',
        error: 'Unauthorized'
      }
    }
  })
  async refreshSession(@Request() req): Promise<RefreshSessionResponseDto> {
    return this.authService.refreshSession(req.user);
  }

  @Delete('session/:leadId')
  async deleteSession(
    @Request() request,
    @Param('leadId') leadId: string, // Get leadId from URL param
  ): Promise<any> {
    // You might want to validate leadId here
    return this.authService.deleteToken(leadId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the authenticated user profile',
    description: 'Returns the user profile associated with the current session. Returns null fields if session is unauthenticated.',
  })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async getProfile(@Request() req) {
    const profile = await this.authService.getProfile(req.user);
    if (!profile) {
      return { authenticated: false };
    }
    return { authenticated: true, user: profile };
  }

  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 requests per 15 minutes
  @UseGuards(JwtAuthGuard)
  @Post('login')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Login with email and password using an existing session token',
    description: `Authenticates a user and converts visitor session to authenticated session.

**Rate Limit:** 3 requests per 15 minutes per IP address to prevent brute-force attacks.

**If rate limit exceeded:** Returns 429 Too Many Requests`
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful - returns JWT access token',
    type: LoginResponseDto,
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid session token, email, or password' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Session is already authenticated' 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Too Many Requests - Rate limit exceeded (3 requests per 15 minutes)',
    schema: {
      example: {
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
        error: 'Too Many Requests'
      }
    }
  })
  async login(
    @Request() req,
    @Body() loginDto: LoginDto,
  ): Promise<LoginResponseDto> {
    return this.authService.login(loginDto, req);
  }

  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @UseGuards(JwtAuthGuard)
  @Post('register')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Register a new user account',
    description: `Creates a new user account and converts the visitor session to an authenticated session.

**Rate Limit:** 5 requests per 15 minutes per IP address to prevent abuse.

**If rate limit exceeded:** Returns 429 Too Many Requests`
  })
  @ApiBody({ type: UserRegistrationDto })
  @ApiResponse({ 
    status: 201, 
    description: 'User successfully registered - returns JWT access token',
    type: RegisterResponseDto,
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Session already authenticated or validation error',
    schema: {
      example: {
        statusCode: 400,
        message: 'This session is already authenticated. Please use a new session to register.',
        error: 'Bad Request'
      }
    }
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Conflict - Email already exists. The user should try logging in or use a different email address.',
    schema: {
      example: {
        statusCode: 409,
        message: 'An account with this email address already exists. Please use a different email or try logging in.',
        error: 'Conflict'
      }
    }
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Too Many Requests - Rate limit exceeded (5 requests per 15 minutes)',
    schema: {
      example: {
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
        error: 'Too Many Requests'
      }
    }
  })
  async register(
    @Request() req,
    @Body() userRegistrationDto: UserRegistrationDto,
  ): Promise<RegisterResponseDto> {
    // req.user contains the session from JWT token
    const session = req.user;
    
    // Ensure this is an unauthenticated session
    if (session.userId) {
      throw new BadRequestException('This session is already authenticated. Please use a new session to register.');
    }
    
    // Create the new user
    const role = userRegistrationDto.companyName ? 'tenantAdmin' : undefined;
    const user = await this.usersService.create(
      userRegistrationDto.email,
      userRegistrationDto.password,
      userRegistrationDto.dateOfBirth ? new Date(userRegistrationDto.dateOfBirth) : undefined,
      userRegistrationDto.firstName,
      userRegistrationDto.lastName,
      userRegistrationDto.companyName,
      role,
    );
    
    // Send welcome email with verification link (async, don't wait for it)
    this.authService.sendWelcomeEmail(
      user.email,
      user.emailVerificationToken,
      user.firstName,
      user.lastName,
    ).catch(error => {
      // Log error but don't fail registration
      console.error('Failed to send welcome email:', error);
    });
    
    // Authenticate the session by associating it with the new user
    return this.authService.authenticateSession(session._id, user._id.toString());
  }

  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @UseGuards(JwtAuthGuard)
  @Post('onboard-tenant')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deferred tenant creation: create tenant for an authenticated user',
    description: `Creates a new tenant for the authenticated user and links them as tenantAdmin.
The user must already be registered (via POST /auth/register with companyName).
This is step 2 of the self-service signup: user picks a plan on the Onboarding page, then this endpoint creates the tenant.

**Rate Limit:** 5 requests per 15 minutes.`,
  })
  @ApiResponse({ status: 201, description: 'Tenant created', schema: { example: { tenantId: 'acme-corp' } } })
  @ApiResponse({ status: 400, description: 'User already has a tenant or user not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async onboardTenant(
    @Request() req,
    @Body() body: { name: string; description: string; domain?: string; planSlug?: string },
  ) {
    return this.authService.onboardTenantDeferred(req.user, body);
  }

  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 requests per 15 minutes
  @Post('forgot-password')
  @ApiOperation({ 
    summary: 'Request password reset (Public endpoint - no authentication required)',
    description: `Sends a password reset email with a 64-character hex token valid for 1 hour. Returns a generic success message regardless of whether the email exists in the system (security best practice to prevent email enumeration).
    
    **Rate Limit:** 3 requests per 15 minutes per IP address to prevent abuse and email flooding.
    
    **If rate limit exceeded:** Returns 429 Too Many Requests
    
    **Frontend Implementation:**
    1. User clicks "Forgot Password?" on login page
    2. Show email input form (no authentication needed)
    3. Make POST request with email in body
    4. Always show success message (don't reveal if email exists)
    5. Tell user: "If account exists, check email for reset link"
    6. Email contains link to /reset-password?token=<64-char-token>
    
    **Security Note:** Always returns 200 success, even if email doesn't exist, to prevent account enumeration attacks.`
  })
  @ApiBody({ 
    type: ForgotPasswordDto,
    examples: {
      valid: {
        summary: 'Request password reset',
        value: {
          email: 'user@example.com'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Generic success message. An email will be sent if the email address exists in the system.',
    type: ForgotPasswordResponseDto,
    schema: {
      example: {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request - email format is invalid',
    schema: {
      example: {
        statusCode: 400,
        message: ['email must be an email'],
        error: 'Bad Request'
      }
    }
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Too Many Requests - Rate limit exceeded (3 requests per 15 minutes)',
    schema: {
      example: {
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
        error: 'Too Many Requests'
      }
    }
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Too many requests - rate limiting applied'
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Server error (e.g., email service failure). Note: Returns 200 to user but logs error internally for security.',
    schema: {
      example: {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      }
    }
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Request() request,
  ): Promise<ForgotPasswordResponseDto> {
    return this.authService.forgotPassword(forgotPasswordDto, request);
  }

  @Post('reset-password')
  @ApiOperation({ 
    summary: 'Reset password using token (Public endpoint - no authentication required)',
    description: `Resets the user password using the 64-character hex token received via email. The token is valid for 1 hour and can only be used once. User must log in manually after successful reset.
    
    **Frontend Implementation:**
    1. User clicks email link → lands on /reset-password?token=<token>
    2. Extract token from URL query parameter
    3. Show new password input form (no authentication needed - public page)
    4. Make POST request with body: { token, newPassword }
    5. On success: show success message
    6. Redirect to /login page
    7. User must enter email + new password to log in
    8. Handle validation errors inline (show password requirements)
    
    **Password Requirements:**
    • Minimum 8 characters
    • At least one uppercase letter (A-Z)
    • At least one lowercase letter (a-z)
    • At least one number (0-9)
    • At least one special character (@$!%*?&)
    
    **Security:** Does NOT automatically log in user. All existing sessions remain active until user logs in again (manual session management).`
  })
  @ApiBody({ 
    type: ResetPasswordDto,
    examples: {
      valid: {
        summary: 'Valid password reset',
        value: {
          token: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
          newPassword: 'NewSecureP@ss123'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Password reset successful. User must now log in manually with their new password.',
    type: ResetPasswordResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Your password has been reset successfully. Please log in with your new password.'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - multiple possible scenarios',
    schema: {
      oneOf: [
        {
          description: 'Invalid or expired reset token',
          example: {
            statusCode: 400,
            message: 'Invalid or expired reset token',
            error: 'Bad Request'
          }
        },
        {
          description: 'Password too short',
          example: {
            statusCode: 400,
            message: ['Password must be at least 8 characters long'],
            error: 'Bad Request'
          }
        },
        {
          description: 'Password does not meet complexity requirements',
          example: {
            statusCode: 400,
            message: ['Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'],
            error: 'Bad Request'
          }
        },
        {
          description: 'Token already used',
          example: {
            statusCode: 400,
            message: 'Invalid or expired reset token',
            error: 'Bad Request'
          }
        },
        {
          description: 'User not found (edge case)',
          example: {
            statusCode: 400,
            message: 'User not found',
            error: 'Bad Request'
          }
        }
      ]
    }
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Get('verify-email')
  @ApiOperation({ 
    summary: 'Verify email address using token',
    description: 'Verifies the user\'s email address using the token sent in the welcome email. This endpoint is typically called when the user clicks the verification link in their email.'
  })
  @ApiQuery({
    name: 'token',
    description: 'Email verification token from the welcome email',
    required: true,
    type: String,
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Email verified successfully',
    type: VerifyEmailResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Email verified successfully! You can now access all features.'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid or expired verification token',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid or expired verification token',
        error: 'Bad Request'
      }
    }
  })
  async verifyEmail(
    @Query('token') token: string,
  ): Promise<VerifyEmailResponseDto> {
    return this.authService.verifyEmail(token);
  }

  @Post('change-password-request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Request password change (Authenticated users only)',
    description: `Generates a 64-character hex verification token and sends it to the authenticated user's email. The user must click the link in the email to proceed with changing their password.
    
    **Key Differences from forgot-password:**
    • Requires authenticated session (Authorization: Bearer <token>)
    • User stays logged in after password change
    • Token linked to authenticated user's session
    
    **Frontend Implementation:**
    1. User clicks "Change Password" in settings
    2. Make POST request with Authorization header
    3. Show success message telling user to check email
    4. Email contains link to /change-password?token=<64-char-token>
    
    **No request body needed** - user info extracted from JWT token.`
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification email sent successfully. Tell user to check their email.',
    type: ChangePasswordRequestResponseDto,
    schema: {
      example: {
        success: true,
        message: 'A password change verification link has been sent to your email'
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - missing or invalid authentication token in Authorization header',
    schema: {
      example: {
        statusCode: 401,
        message: 'You must be logged in to change your password',
        error: 'Unauthorized'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - email service failure (rare)',
    schema: {
      example: {
        statusCode: 400,
        message: 'Failed to send verification email',
        error: 'Bad Request'
      }
    }
  })
  async changePasswordRequest(
    @Request() request,
  ): Promise<ChangePasswordRequestResponseDto> {
    return this.authService.changePasswordRequest(request);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Change password with verification token (Authenticated users only)',
    description: `Changes the authenticated user's password using the verification token received via email.
    
    **Security Checks:**
    • Token must be valid (not expired or already used)
    • Token must belong to the authenticated user
    • New password must meet complexity requirements
    
    **Frontend Implementation:**
    1. User clicks email link → lands on /change-password?token=<token>
    2. Extract token from URL query parameter
    3. Show password input form (user must be logged in)
    4. Make POST request with Authorization header + body: { token, newPassword }
    5. On success: show message, user stays logged in, redirect to dashboard
    6. Handle validation errors inline (password requirements)
    
    **Password Requirements:**
    • Minimum 8 characters
    • At least one uppercase letter (A-Z)
    • At least one lowercase letter (a-z)  
    • At least one number (0-9)
    • At least one special character (@$!%*?&)
    
    **Important:** User remains logged in with same session (no re-authentication needed).`
  })
  @ApiBody({ 
    type: ChangePasswordDto,
    examples: {
      valid: {
        summary: 'Valid password change request',
        value: {
          token: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
          newPassword: 'NewSecureP@ss123'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Password changed successfully. User remains authenticated.',
    type: ChangePasswordResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Your password has been changed successfully'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - multiple possible scenarios',
    schema: {
      oneOf: [
        {
          description: 'Invalid or expired verification token',
          example: {
            statusCode: 400,
            message: 'Invalid or expired verification token',
            error: 'Bad Request'
          }
        },
        {
          description: 'Password validation failed',
          example: {
            statusCode: 400,
            message: ['Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'],
            error: 'Bad Request'
          }
        },
        {
          description: 'User not found',
          example: {
            statusCode: 400,
            message: 'User not found',
            error: 'Bad Request'
          }
        }
      ]
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - token does not belong to authenticated user or no valid session',
    schema: {
      example: {
        statusCode: 401,
        message: 'This verification token does not belong to your account',
        error: 'Unauthorized'
      }
    }
  })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() request,
  ): Promise<ChangePasswordResponseDto> {
    return this.authService.changePassword(changePasswordDto, request);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-email-request')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Request email change - Step 1 of 3',
    description: `Initiates the secure 3-step email change process. This is Step 1: verify ownership of current email.

**Security Model:**
This flow requires access to THREE separate resources to complete:
1. Active authenticated session (you must be logged in)
2. Access to CURRENT email inbox (proves you control the existing account email)
3. Access to NEW email inbox (proves you control the target email)

This triple verification protects against account takeover even if an attacker has your password and session.

**Process Flow:**

**Step 1 (this endpoint):** Request Email Change
• Requires: Authenticated session
• Sends: Verification email to your CURRENT email address
• Result: Token sent to current inbox

**Step 2:** Submit New Email (POST /auth/change-email)
• Requires: Authenticated session + token from Step 1
• Sends: Verification email to your NEW email address
• Result: Token sent to new inbox

**Step 3:** Confirm Change (POST /auth/confirm-email-change)
• Requires: Token from Step 2 (public endpoint)
• Action: Updates email address and revokes all sessions
• Result: Must log in again with new email

**Frontend Implementation:**
\`\`\`typescript
// User clicks "Change Email" in settings
const response = await fetch('/auth/change-email-request', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token }
});

const data = await response.json();
// { message: "Verification sent...", sentTo: "u***@example.com" }

// Show user: "Check your email (u***@example.com) for verification link"
// User clicks link in current email → proceeds to Step 2
\`\`\`

**Security Notes:**
• Token expires in 1 hour
• Only one active email change request allowed per user
• Starting a new request invalidates previous requests
• All sessions are revoked upon completion (Step 3)`
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification email sent to current email address',
    type: ChangeEmailRequestResponseDto,
    schema: {
      example: {
        message: 'Verification email sent to your current email address. Please check your inbox.',
        sentTo: 'u***@example.com'
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - must be logged in',
    schema: {
      example: {
        statusCode: 401,
        message: 'You must be logged in to change your email',
        error: 'Unauthorized'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - user not found',
    schema: {
      example: {
        statusCode: 400,
        message: 'User not found',
        error: 'Bad Request'
      }
    }
  })
  async changeEmailRequest(@Request() request): Promise<ChangeEmailRequestResponseDto> {
    return this.authService.changeEmailRequest(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-email')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Submit new email with verification token - Step 2 of 3',
    description: `Second step of the secure 3-step email change process. Submit your new email address with the token from Step 1.

**Prerequisites:**
• Must have completed Step 1 (POST /auth/change-email-request)
• Must have received verification token via email to CURRENT email address
• Token must not be expired (1 hour validity)

**What This Endpoint Does:**
1. Validates token from current email (proves ownership)
2. Validates new email isn't already registered
3. Validates new email isn't pending for another user
4. Sends verification email to NEW email address
5. Returns confirmation that email was sent

**Frontend Implementation:**
\`\`\`typescript
// User received token via email to CURRENT address
// User enters NEW email in form
// User clicks "Continue"

const response = await fetch('/auth/change-email', {
  method: 'POST',
  headers: { 
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    token: 'abc123...', // From email to current address
    newEmail: 'newemail@example.com'
  })
});

const data = await response.json();
// { message: "Verification sent...", sentTo: "n***@example.com" }

// Show: "Check newemail@example.com to complete the change"
// User checks NEW email inbox → clicks verification link → Step 3
\`\`\`

**Security Features:**
• Requires valid token from Step 1 (current email verification)
• Checks new email isn't already registered
• Checks new email isn't pending for another account
• New email different from current email
• Token expires in 1 hour from Step 1`
  })
  @ApiBody({ 
    type: ChangeEmailDto,
    examples: {
      standard: {
        summary: 'Submit new email with verification token',
        value: {
          token: 'abc123def456...', // 64 character token from email
          newEmail: 'newemail@example.com'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification email sent to new email address',
    type: ChangeEmailResponseDto,
    schema: {
      example: {
        message: 'Verification email sent to your new email address. Please check the inbox to complete the change.',
        sentTo: 'n***@example.com'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - multiple scenarios',
    schema: {
      oneOf: [
        {
          description: 'Invalid or expired token',
          example: {
            statusCode: 400,
            message: 'Invalid or expired verification token',
            error: 'Bad Request'
          }
        },
        {
          description: 'New email same as current',
          example: {
            statusCode: 400,
            message: 'New email must be different from current email',
            error: 'Bad Request'
          }
        },
        {
          description: 'Email already registered',
          example: {
            statusCode: 400,
            message: 'This email address is already registered',
            error: 'Bad Request'
          }
        },
        {
          description: 'Email pending for another user',
          example: {
            statusCode: 400,
            message: 'This email address is already pending verification for another account',
            error: 'Bad Request'
          }
        }
      ]
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - must be logged in',
    schema: {
      example: {
        statusCode: 401,
        message: 'You must be logged in to change your email',
        error: 'Unauthorized'
      }
    }
  })
  async changeEmail(
    @Body() changeEmailDto: ChangeEmailDto,
    @Request() request,
  ): Promise<ChangeEmailResponseDto> {
    return this.authService.changeEmail(changeEmailDto, request.user);
  }

  @Post('confirm-email-change')
  @ApiOperation({ 
    summary: 'Confirm email change - Step 3 of 3 (Public)',
    description: `Final step of the secure 3-step email change process. Completes the email change, revokes all sessions, and returns a new visitor token.

**Prerequisites:**
• Must have completed Step 1 (verified current email)
• Must have completed Step 2 (submitted new email)
• Must have received verification token via email to NEW email address
• Token must not be expired (1 hour from Step 1)

**What This Endpoint Does:**
1. Validates token from new email (proves ownership of new email)
2. Updates user's email address in database
3. **REVOKES ALL ACTIVE SESSIONS** across all devices
4. **CREATES NEW VISITOR SESSION** and returns access_token
5. Sends confirmation email to new address

**CRITICAL: Session Revocation & New Token**
• All existing authenticated sessions are revoked for security
• A new unauthenticated visitor session token is returned
• Use the new token for subsequent visitor activity
• User must log in again using the NEW email address to authenticate

**Frontend Implementation:**
\`\`\`typescript
// User clicks link in email sent to NEW address
// Extract token from URL: /confirm-email-change?token=xyz789...

const response = await fetch('/auth/confirm-email-change', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'xyz789...' // From email to NEW address
  })
});

if (response.ok) {
  const data = await response.json();
  // { 
  //   success: true, 
  //   message: "Email changed. Please log in with new email.",
  //   newEmail: "newemail@example.com",
  //   access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  // }
  
  // Store the new visitor token
  localStorage.setItem('access_token', data.access_token);
  
  // Redirect to login page
  window.location.href = '/login';
  
  // Show success message with new email
  alert('Email changed successfully! Please log in with ' + data.newEmail);
}
\`\`\`

**Response Structure:**
The response includes both success information AND a new visitor session token:
• \`success\`: true
• \`message\`: Instructions to log in with new email
• \`newEmail\`: The updated email address
• \`access_token\`: New visitor token (all old tokens revoked)

**Security Features:**
• Public endpoint (token-based authentication, no session required)
• Validates token from new email (Step 2)
• Race condition protection (double-checks email availability)
• Revokes all sessions across all devices
• Issues new visitor session automatically
• Forces re-login with new email
• Sends confirmation to new email`
  })
  @ApiBody({ 
    type: ConfirmEmailChangeDto,
    examples: {
      standard: {
        summary: 'Confirm with token from new email',
        value: {
          token: 'xyz789ghi012...' // 64 character token from new email
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Email change completed successfully - all sessions revoked and new visitor token issued',
    type: ConfirmEmailChangeResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Email address successfully changed. Please log in with your new email.',
        newEmail: 'newemail@example.com',
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NDkzOGI4MWU3ZjA3NTE2YjY2NWU1ZSIsImlhdCI6MTczMjgzMTQxNiwiZXhwIjoxMDE3MzI4MzE0MTZ9.x8234tXdFGpvZVDcrT3c0FCohRH47eD2I_jdXv3WPl4'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - multiple scenarios',
    schema: {
      oneOf: [
        {
          description: 'Invalid or expired token',
          example: {
            statusCode: 400,
            message: 'Invalid or expired verification token',
            error: 'Bad Request'
          }
        },
        {
          description: 'Invalid email change request',
          example: {
            statusCode: 400,
            message: 'Invalid email change request',
            error: 'Bad Request'
          }
        },
        {
          description: 'Email no longer available (race condition)',
          example: {
            statusCode: 400,
            message: 'This email address is no longer available',
            error: 'Bad Request'
          }
        }
      ]
    }
  })
  async confirmEmailChange(
    @Body() confirmEmailChangeDto: ConfirmEmailChangeDto,
  ): Promise<ConfirmEmailChangeResponseDto> {
    return this.authService.confirmEmailChange(confirmEmailChangeDto);
  }

}
