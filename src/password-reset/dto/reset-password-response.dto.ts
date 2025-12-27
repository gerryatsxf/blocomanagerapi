import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indicates whether the password reset was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 'Your password has been reset successfully. Please log in with your new password.',
    description: 'Success message instructing user to log in',
  })
  message: string;
}
