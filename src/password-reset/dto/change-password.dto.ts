import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2',
    description: 'Password change verification token received via email. MUST be exactly 64 characters (hex string format). Token is valid for 1 hour and can only be used once.',
  })
  @IsNotEmpty({ message: 'Verification token is required' })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'NewSecureP@ssw0rd!',
    description: `New password with the following requirements:
    • Minimum 8 characters
    • At least one uppercase letter (A-Z)
    • At least one lowercase letter (a-z)
    • At least one number (0-9)
    • At least one special character (@$!%*?&)
    Example valid passwords: "MyPass123!", "Secure@2024", "Test$Password1"`,
  })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}
