import { IsArray, IsString, IsNumber } from 'class-validator';

export class GetFreeBusyDto {
  @IsNumber()
  startTime: number;

  @IsNumber()
  endTime: number;

  @IsArray()
  @IsString({ each: true })
  emails: string[];
}