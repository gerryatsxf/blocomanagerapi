import { IsString, IsDate, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class AttendeeDto {
  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;
}

export class UpdateMeetingDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startTime?: Date;

  @ApiProperty({ required: false })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endTime?: Date;

  @ApiProperty({ type: [AttendeeDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendeeDto)
  @IsOptional()
  attendees?: AttendeeDto[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;
}
