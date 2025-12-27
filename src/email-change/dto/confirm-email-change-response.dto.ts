import { ApiProperty } from '@nestjs/swagger';

export class ConfirmEmailChangeResponseDto {
  @ApiProperty({ 
    example: true,
    description: 'Indicates the email change was successful'
  })
  success: boolean;

  @ApiProperty({ 
    example: 'Email address successfully changed. Please log in with your new email.',
    description: 'Success message confirming email change and instructing user to log in again'
  })
  message: string;

  @ApiProperty({ 
    example: 'newemail@example.com',
    description: 'The new email address that is now active'
  })
  newEmail: string;

  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NDkzOGI4MWU3ZjA3NTE2YjY2NWU1ZSIsImlhdCI6MTczMjgzMTQxNiwiZXhwIjoxMDE3MzI4MzE0MTZ9.x8234tXdFGpvZVDcrT3c0FCohRH47eD2I_jdXv3WPl4',
    description: 'New unauthenticated visitor session token - all previous sessions have been revoked'
  })
  access_token: string;
}
