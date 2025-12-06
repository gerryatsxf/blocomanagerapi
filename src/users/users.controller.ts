import {Controller, Get, UseGuards, Request, Delete, Param, HttpCode, HttpStatus, UnauthorizedException, NotFoundException} from '@nestjs/common';
import {ApiBearerAuth, ApiTags, ApiResponse, ApiOperation, ApiParam} from '@nestjs/swagger';
import {JwtAuthGuard} from 'src/auth/guards/jwt-auth.guard';
import {GetProfileResponseDto} from './dto/get-profile-response.dto';
import {UsersService} from './users.service';
import {GetProfileResultDto, UserProfileDto} from './dto/get-profile-result.dto';
import {GetVisitorSessionResponseDto} from './dto/get-visitor-session-response.dto';
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
}
