import { IsString, IsNotEmpty } from 'class-validator';

export class UploadImageDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  imageType: 'logo' | 'profile';
}
