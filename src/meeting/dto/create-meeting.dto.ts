import { IsString, IsDate, IsEmail, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MeetingStatus } from '../entities/meeting.entity';

class AttendeeDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  name?: string;
}

export class CreateMeetingDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty()
  @IsString()
  provider: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  endTime: Date;

  @ApiProperty({ type: [AttendeeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendeeDto)
  attendees: AttendeeDto[];

  @ApiProperty()
  @IsString()
  customerName: string;

  @ApiProperty()
  @IsEmail()
  customerEmail: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bookingId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;
}
