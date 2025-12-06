import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordResponseDto {
  @ApiProperty({
    example: true,
    description: 'Always returns true for security reasons',
  })
  success: boolean;

  @ApiProperty({
    example: 'If the email exists, a password reset link has been sent',
    description: 'Generic message that does not reveal if email exists',
  })
  message: string;
}
