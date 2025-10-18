import { ApiProperty } from '@nestjs/swagger';

class CreateMeetingRequestDto {
  // @ApiProperty({
  //   description: 'The timestamp of the meeting',
  //   example: 1629462063,
  // })
  // timestamp: number;

  @ApiProperty({
    description: 'The type of meeting',
    example: 'tutoring',
    enum: ['tutoring', 'consultancy'],
  })
  type: 'tutoring' | 'consultancy';

  @ApiProperty({
    description: 'The display name of the meeting',
  })
  displayName = 'BlocoManager - Espacio de reuniones';
}

export default CreateMeetingRequestDto;
