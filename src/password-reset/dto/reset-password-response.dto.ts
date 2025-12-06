import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indicates whether the password reset was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 'Password has been reset successfully',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Optional: JWT access token for automatic login after reset',
    required: false,
  })
  access_token?: string;
}
