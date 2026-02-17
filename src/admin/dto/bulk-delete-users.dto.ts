import { IsArray, ArrayMinSize, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkDeleteUsersDto {
  @ApiProperty({
    description: 'Array of user IDs to delete',
    example: ['507f1f77bcf86cd799439011', '507f191e810c19729de860ea'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one user ID is required' })
  @IsString({ each: true, message: 'Each user ID must be a string' })
  userIds: string[];
}
