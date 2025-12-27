import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indicates whether the password change was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 'Your password has been changed successfully',
    description: 'Success message',
  })
  message: string;
}
