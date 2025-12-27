import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmEmailChangeDto {
  @ApiProperty({ 
    example: 'xyz789ghi012...',
    description: 'Verification token received via email to new email address',
    minLength: 64,
    maxLength: 64
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
