import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventParticipantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  email: string;
}

export class CreateEventConferencingDto {
  @IsString()
  provider: string;

  @IsOptional()
  details?: {
    url?: string;
    meetingCode?: string;
    password?: string;
    phone?: string[];
  };
}

export class CreateEventNotificationDto {
  @IsString()
  type: string;

  @IsNumber()
  minutesBeforeEvent: number;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;
}

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  startTime: number;

  @IsNumber()
  endTime: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEventParticipantDto)
  participants?: CreateEventParticipantDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEventConferencingDto)
  conferencing?: CreateEventConferencingDto;

  @IsOptional()
  @IsString()
  calendarId?: string;

  @IsOptional()
  @IsBoolean()
  busy?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEventNotificationDto)
  notifications?: CreateEventNotificationDto[];

  @IsOptional()
  @IsBoolean()
  notifyParticipants?: boolean;
}