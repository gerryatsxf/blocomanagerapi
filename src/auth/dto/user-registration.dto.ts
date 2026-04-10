import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsDate, IsOptional } from 'class-validator';

export class UserRegistrationDto {
  @ApiProperty({
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
  })
  @IsNotEmpty()
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dateOfBirth?: Date;

  @ApiProperty({
    type: String,
  })
  firstName: string;

  @ApiProperty({
    type: String,
  })
  lastName: string;

  @ApiProperty({
    type: String,
    required: false,
    description: 'Company name — if provided, user is created as tenantAdmin',
  })
  @IsOptional()
  companyName?: string;
}
