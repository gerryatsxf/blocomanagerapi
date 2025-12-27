import { ApiProperty } from '@nestjs/swagger';

export class CreateContactResponseDto {
  @ApiProperty({ 
    example: true,
    description: 'Indicates the contact request was successfully submitted'
  })
  success: boolean;

  @ApiProperty({ 
    example: 'Your message has been received. We will get back to you shortly.',
    description: 'Success message confirming submission'
  })
  message: string;

  @ApiProperty({ 
    example: 'CR-20251222-ABC123',
    description: 'Unique reference ID for tracking the contact request'
  })
  referenceId: string;
}
