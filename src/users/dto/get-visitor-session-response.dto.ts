import { ApiProperty } from '@nestjs/swagger';

export class GetVisitorSessionResponseDto {
  @ApiProperty({ 
    example: 'visitor', 
    description: 'Type of session - always "visitor" for unauthenticated sessions. Use this field to detect unauthenticated state.',
    enum: ['visitor']
  })
  sessionType: string;
}
