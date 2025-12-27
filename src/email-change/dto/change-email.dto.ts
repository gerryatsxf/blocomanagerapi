import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ChangeEmailDto {
  @ApiProperty({ 
    example: 'abc123def456...',
    description: 'Verification token received via email to current email address',
    minLength: 64,
    maxLength: 64
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ 
    example: 'newemail@example.com',
    description: 'The new email address to change to'
  })
  @IsEmail()
  @IsNotEmpty()
  newEmail: string;
}
