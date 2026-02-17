import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address'
  })
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'User first name',
    required: false
  })
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
    required: false
  })
  lastName?: string;

  @ApiProperty({
    example: 'user',
    description: 'User role',
    required: false
  })
  role?: string;

  @ApiProperty({
    example: 'tenant123',
    description: 'Tenant ID',
    required: false
  })
  tenant?: string;
}

export class GetProfileResultDto {
  @ApiProperty({
    type: UserProfileDto,
    description: 'User profile information'
  })
  user: UserProfileDto;
}
