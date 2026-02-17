import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  templateSlug: string;

  @IsString()
  @IsNotEmpty()
  templateTenant: string;

  @IsString()
  @IsNotEmpty()
  templateDescription: string;

  @IsOptional()
  config?: Record<string, any>;
}
