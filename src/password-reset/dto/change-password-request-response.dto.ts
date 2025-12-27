import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordRequestResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indicates whether the request was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 'A password change verification link has been sent to your email',
    description: 'Success message',
  })
  message: string;
}
