import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestSuperAdminDto {
  // No body needed, but keeping structure for future use
}

export class GrantSuperAdminDto {
  @ApiProperty({ example: '123456', description: '6-digit code sent to admin email' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits' })
  code: string;

  @ApiProperty({ example: 'user@example.com', description: 'Email of user to grant super admin role' })
  @IsEmail()
  targetEmail: string;
}
