import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5Mjc3YzcxNzRhNWFmY2E0MWYyY2EwYSIsImlhdCI6MTc2NDE5NTQ2MywiZXhwIjoxMDE3NjQxOTU0NjN9.Oav1GZZTP825ETWESCiBI5yGwaLpkfSWYPaI18qqFA0',
    description: 'JWT access token for authenticated session',
  })
  access_token: string;
}
