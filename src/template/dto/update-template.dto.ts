import { IsString, IsOptional } from 'class-validator';

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  templateDescription?: string;

  @IsOptional()
  config?: Record<string, any>;
}
