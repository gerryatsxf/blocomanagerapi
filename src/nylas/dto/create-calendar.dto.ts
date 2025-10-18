import { IsString, IsOptional } from 'class-validator';

export class CreateCalendarDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}