import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indicates whether the profile update was successful',
  })
  success: boolean;

  @ApiProperty({
    example: 'Profile updated successfully',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    description: 'Updated user profile data',
    example: {
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe'
    }
  })
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}
