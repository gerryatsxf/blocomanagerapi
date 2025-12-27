import { ApiProperty } from '@nestjs/swagger';

export class ChangeEmailResponseDto {
  @ApiProperty({ 
    example: 'Verification email sent to your new email address. Please check the inbox to complete the change.',
    description: 'Success message instructing user to check their new email'
  })
  message: string;

  @ApiProperty({ 
    example: 'newemail@example.com',
    description: 'The new email address where verification was sent (partially masked for security)'
  })
  sentTo: string;
}
