import { ApiProperty } from '@nestjs/swagger';

export class ChangeEmailRequestResponseDto {
  @ApiProperty({ 
    example: 'Verification email sent to your current email address. Please check your inbox.',
    description: 'Success message instructing user to check their current email'
  })
  message: string;

  @ApiProperty({ 
    example: 'user@example.com',
    description: 'The current email address where verification was sent (partially masked for security)'
  })
  sentTo: string;
}
