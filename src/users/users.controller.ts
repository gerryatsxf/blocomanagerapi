import {Controller, Get, UseGuards, Request, Delete, Param, HttpCode, HttpStatus, UnauthorizedException, NotFoundException, Patch, Body} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiResponse, ApiOperation, ApiParam, ApiBody} from '@nestjs/swagger';
import {JwtAuthGuard} from 'src/auth/guards/jwt-auth.guard';
import {GetProfileResponseDto} from './dto/get-profile-response.dto';
import {UsersService} from './users.service';
import {GetProfileResultDto, UserProfileDto} from './dto/get-profile-result.dto';
import {GetVisitorSessionResponseDto} from './dto/get-visitor-session-response.dto';
import {UpdateProfileDto} from './dto/update-profile.dto';
import {UpdateProfileResponseDto} from './dto/update-profile-response.dto';
import {AuthService} from '../auth/auth.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
  ) {}
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get user profile or session information',
    description: `Returns different response structures based on the token type. Always returns 200 for valid tokens.

**AUTHENTICATED TOKEN** (after POST /auth/login or /auth/register):
Returns GetProfileResponseDto with user data:
\`\`\`json
{
  "data": {
    "user": {
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
\`\`\`

**UNAUTHENTICATED SESSION TOKEN** (from POST /auth/session):
Returns GetVisitorSessionResponseDto indicating visitor status:
\`\`\`json
{
  "sessionType": "visitor"
}
\`\`\`

**KEY DISCRIMINATOR**: Check for \`sessionType === "visitor"\` to detect unauthenticated sessions.

**INVALID/EXPIRED TOKEN**: Returns 401 Unauthorized

**Implementation Guide**:
\`\`\`typescript
const response = await fetch('/users/profile', {
  headers: { 'Authorization': 'Bearer ' + token }
});

if (response.status === 401) {
  // Token is invalid/expired
  return 'INVALID_TOKEN';
}

const data = await response.json();

if (data.sessionType === 'visitor') {
  // Unauthenticated visitor session
  return 'UNAUTHENTICATED';
}

if (data.data?.user) {
  // Authenticated user
  return 'AUTHENTICATED';
}
\`\`\`
`
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Authenticated user - Returns user profile data', 
    type: GetProfileResponseDto 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Unauthenticated visitor - Returns simple indicator with sessionType="visitor"', 
    type: GetVisitorSessionResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid or expired token - Token is malformed, expired, or session not found' 
  })
  async getProfile(@Request() req): Promise<GetProfileResponseDto | GetVisitorSessionResponseDto> {
    // req.user contains the session object from JWT strategy
    const session = req.user;
    
    // Check if this is an authenticated session (has userId) or a visitor session
    if (session.userId) {
      // Authenticated session - fetch user details
      const user = await this.usersService.findById(session.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const result = new GetProfileResultDto();
      result.user = {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };
      
      const response = new GetProfileResponseDto();
      response.data = result;
      return response;
    } else {
      // Visitor session - return simple visitor indicator
      const visitorResponse = new GetVisitorSessionResponseDto();
      visitorResponse.sessionType = 'visitor';
      return visitorResponse;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Delete your own user account and get new unauthenticated session',
    description: `Permanently deletes your account and all associated data. This action cannot be undone.

After deletion, the current session is revoked and a new unauthenticated visitor session token is returned, similar to logout behavior.

**Response:**
\`\`\`json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\`\`\`

Use the new \`access_token\` for subsequent visitor activity. The account and all data are permanently deleted.`
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Account successfully deleted - returns new unauthenticated session token',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NDkzOGI4MWU3ZjA3NTE2YjY2NWU1ZSIsImlhdCI6MTczMjgzMTQxNiwiZXhwIjoxMDE3MzI4MzE0MTZ9.x8234tXdFGpvZVDcrT3c0FCohRH47eD2I_jdXv3WPl4'
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or expired token'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Cannot delete account using a visitor session token'
  })
  async deleteMyAccount(@Request() req): Promise<{ access_token: string }> {
    const session = req.user;
    
    // Ensure this is an authenticated session
    if (!session.userId) {
      throw new UnauthorizedException('Cannot delete account. You must be logged in with an authenticated account.');
    }

    // Delete the user
    const deletedUser = await this.authService.delete(session.userId);
    
    if (!deletedUser) {
      throw new NotFoundException('User account not found or already deleted.');
    }

    console.log(`🗑️  User account deleted: ${deletedUser.email} (ID: ${session.userId})`);

    // Revoke current session and create new unauthenticated session
    // This is the same behavior as logout
    return this.authService.deleteAccountAndDegradeSession(session, req);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Update your profile (first name, last name)',
    description: `Updates the authenticated user's profile information. Use PATCH to update specific fields without affecting others.
    
    **Updatable Fields:**
    • firstName (optional)
    • lastName (optional)
    
    **NOT Updatable via this endpoint:**
    • email - Use a separate email change flow (requires verification)
    • password - Use POST /auth/change-password-request endpoint
    
    **Frontend Implementation:**
    1. User edits profile in settings
    2. Make PATCH request with Authorization header
    3. Body contains only fields to update (partial update)
    4. On success: update UI with new profile data
    5. Handle validation errors inline
    
    **Examples:**
    Update both names:
    \`\`\`json
    {
      "firstName": "John",
      "lastName": "Doe"
    }
    \`\`\`
    
    Update only first name:
    \`\`\`json
    {
      "firstName": "Jane"
    }
    \`\`\`
    
    Update only last name:
    \`\`\`json
    {
      "lastName": "Smith"
    }
    \`\`\``
  })
  @ApiBody({ 
    type: UpdateProfileDto,
    examples: {
      bothNames: {
        summary: 'Update both first and last name',
        value: {
          firstName: 'John',
          lastName: 'Doe'
        }
      },
      firstNameOnly: {
        summary: 'Update only first name',
        value: {
          firstName: 'Jane'
        }
      },
      lastNameOnly: {
        summary: 'Update only last name',
        value: {
          lastName: 'Smith'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile updated successfully',
    type: UpdateProfileResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Profile updated successfully',
        user: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - validation failed',
    schema: {
      oneOf: [
        {
          description: 'Empty name provided',
          example: {
            statusCode: 400,
            message: ['First name cannot be empty'],
            error: 'Bad Request'
          }
        },
        {
          description: 'Name too long',
          example: {
            statusCode: 400,
            message: ['First name cannot exceed 50 characters'],
            error: 'Bad Request'
          }
        },
        {
          description: 'No fields to update',
          example: {
            statusCode: 400,
            message: 'No fields to update. Provide at least firstName or lastName.',
            error: 'Bad Request'
          }
        }
      ]
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - must be logged in to update profile',
    schema: {
      example: {
        statusCode: 401,
        message: 'You must be logged in to update your profile',
        error: 'Unauthorized'
      }
    }
  })
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req,
  ): Promise<UpdateProfileResponseDto> {
    const session = req.user;
    
    // Ensure this is an authenticated session
    if (!session || !session.userId) {
      throw new UnauthorizedException('You must be logged in to update your profile');
    }

    // Validate at least one field is provided
    if (!updateProfileDto.firstName && !updateProfileDto.lastName) {
      throw new UnauthorizedException('No fields to update. Provide at least firstName or lastName.');
    }

    // SECURITY: Explicitly whitelist only firstName and lastName
    // This prevents any attempt to update email, password, or other sensitive fields
    const allowedUpdates: Partial<{ firstName: string; lastName: string }> = {};
    
    if (updateProfileDto.firstName !== undefined) {
      allowedUpdates.firstName = updateProfileDto.firstName;
    }
    
    if (updateProfileDto.lastName !== undefined) {
      allowedUpdates.lastName = updateProfileDto.lastName;
    }

    // Update user profile with only whitelisted fields
    const updatedUser = await this.usersService.update(session.userId, allowedUpdates);

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    console.log(`✏️  Profile updated for user: ${updatedUser.email}`);

    return {
      success: true,
      message: 'Profile updated successfully',
      user: {
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      }
    };
  }
}
