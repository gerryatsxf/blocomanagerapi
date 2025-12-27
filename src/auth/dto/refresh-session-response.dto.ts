import { ApiProperty } from '@nestjs/swagger';

export class RefreshSessionResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'New session expiration timestamp (Unix milliseconds)',
    example: 1735228800000,
  })
  expiresAt: number;

  @ApiProperty({
    description: 'Success message',
    example: 'Session refreshed successfully',
  })
  message: string;
}
