import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export enum ContactPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class CreateContactRequestDto {
  @ApiProperty({ 
    example: 'John Doe',
    description: 'Full name of the visitor submitting the contact request',
    minLength: 2,
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ 
    example: 'user@example.com',
    description: 'Email address for follow-up communication'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ 
    example: 'Issue with scheduling',
    description: 'Subject line summarizing the support request',
    minLength: 5,
    maxLength: 200
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  subject: string;

  @ApiProperty({ 
    example: 'medium',
    description: 'Priority level of the support request',
    enum: ContactPriority,
    enumName: 'ContactPriority'
  })
  @IsEnum(ContactPriority)
  @IsNotEmpty()
  priority: ContactPriority;

  @ApiProperty({ 
    example: 'I am having trouble scheduling a meeting. When I try to select a time slot, the calendar does not respond. Can you help?',
    description: 'Detailed message describing the support request or inquiry',
    minLength: 10,
    maxLength: 2000
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  message: string;
}
