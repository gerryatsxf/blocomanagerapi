import {ApiProperty} from '@nestjs/swagger';
import {GetProfileResultDto} from './get-profile-result.dto';

export class GetProfileResponseDto {
  @ApiProperty({
    type: GetProfileResultDto,
    description: 'Wrapper containing user profile data',
    example: {
      data: {
        user: {
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }
      }
    }
  })
  data: GetProfileResultDto;
}
