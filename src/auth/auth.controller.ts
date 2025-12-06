import { Controller, Request, Post, UseGuards, Body, Delete, Param, Get, Query } from '@nestjs/common';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
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
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyEmailResponseDto } from './dto/verify-email-response.dto';

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

  @Delete('session/:leadId')
  async deleteSession(
    @Request() request,
    @Param('leadId') leadId: string, // Get leadId from URL param
  ): Promise<any> {
    // You might want to validate leadId here
    return this.authService.deleteToken(leadId);
  }


  // TODO: find an alternate way of returning this response by using Guards
  // @All('register')
  // async notAllowedRegister(@Request() request, @Res() response): Promise<any> {
  //   // Return a 405 Method Not Allowed error for any HTTP method that is not POST
  //   if (request.method !== 'P  OST') {
  //     response.setHeader('Allow', 'POST');
  //     response.status(405).send({statusCode: 405, error: METHOD_NOT_ALLOWED});
  //   }
  // }

  // @UseGuards(LocalAuthGuard)
  // @Post('login')
  // @ApiBody({type: UserCredentialsDto})
  // async login(@Request() req): Promise<RegisterResponseDto> {
  //   return this.authService.createToken(req.user);
  // }
  
  @UseGuards(JwtAuthGuard)
  @Post('login')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Login with email and password using an existing session token' })
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
  async login(
    @Request() req,
    @Body() loginDto: LoginDto,
  ): Promise<LoginResponseDto> {
    return this.authService.login(loginDto, req);
  }

  @UseGuards(JwtAuthGuard)
  @Post('register')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: UserRegistrationDto })
  @ApiResponse({ 
    status: 201, 
    description: 'User successfully registered - returns JWT access token',
    type: RegisterResponseDto,
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Session already authenticated or validation error' 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Conflict - Email already exists' 
  })
  async register(
    @Request() req,
    @Body() userRegistrationDto: UserRegistrationDto,
  ): Promise<RegisterResponseDto> {
    // req.user contains the session from JWT token
    const session = req.user;
    
    // Ensure this is an unauthenticated session
    if (session.userId) {
      throw new Error('This session is already authenticated. Please use a new session to register.');
    }
    
    // Create the new user
    const user = await this.usersService.create(
      userRegistrationDto.email,
      userRegistrationDto.password,
      userRegistrationDto.dateOfBirth ? new Date(userRegistrationDto.dateOfBirth) : undefined,
      userRegistrationDto.firstName,
      userRegistrationDto.lastName,
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

  @Post('forgot-password')
  @ApiOperation({ 
    summary: 'Request password reset',
    description: 'Sends a password reset email with a token. Returns a generic success message regardless of whether the email exists in the system (security best practice to prevent email enumeration).'
  })
  @ApiBody({ type: ForgotPasswordDto })
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
    description: 'Too many requests - rate limiting applied'
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Request() request,
  ): Promise<ForgotPasswordResponseDto> {
    return this.authService.forgotPassword(forgotPasswordDto, request);
  }

  @Post('reset-password')
  @ApiOperation({ 
    summary: 'Reset password using token',
    description: 'Resets the user password using the token received via email. The token is valid for 1 hour and can only be used once. On success, automatically logs in the user and returns a new access token.'
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Password reset successful. Returns new access token for automatic login.',
    type: ResetPasswordResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Your password has been reset successfully. You are now logged in.',
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid or expired token, or password does not meet requirements',
    schema: {
      example: {
        statusCode: 400,
        message: 'Invalid or expired reset token',
        error: 'Bad Request'
      }
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

  // @All('login')
  // async notAllowedLogin(@Request() request, @Res() response): Promise<any> {
  //   // Return a 405 Method Not Allowed error for any HTTP method that is not POST
  //   if (request.method !== 'POST') {
  //     response.setHeader('Allow', 'POST');
  //     response.status(405).send({statusCode: 405, error: METHOD_NOT_ALLOWED});
  //   }
  // }
}
