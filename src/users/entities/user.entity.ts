import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @ApiProperty({
    type: String,
  })
  @Prop({ required: true, unique: true })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Prop({ required: true })
  password: string;

  @ApiProperty({
    type: String,
  })
  @Prop()
  firstName?: string;

  @ApiProperty({
    type: String,
  })
  @Prop()
  lastName?: string;

  @ApiProperty({
    type: Date,
  })
  @Prop()
  dateOfBirth?: Date;

  @ApiProperty({
    type: Boolean,
    description: 'Whether the user has verified their email address',
    default: false,
  })
  @Prop({ default: false })
  emailVerified: boolean;

  @Prop()
  emailVerificationToken?: string;

  @ApiProperty({
    type: Date,
  })
  createdAt?: Date;

  @ApiProperty({
    type: Date,
  })
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
