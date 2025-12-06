import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NDkzOGI4MWU3ZjA3NTE2YjY2NWU1ZSIsImlhdCI6MTczMjgzMTQxNiwiZXhwIjoxMDE3MzI4MzE0MTZ9.x8234tXdFGpvZVDcrT3c0FCohRH47eD2I_jdXv3WPl4',
    description: 'JWT access token for the new unauthenticated visitor session',
  })
  access_token: string;
}
