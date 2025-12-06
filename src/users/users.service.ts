import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { EncryptionService } from '../encryption/encryption.service';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Generate a random email verification token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async findByEmail(email: string): Promise<UserDocument | undefined> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument | undefined> {
    return this.userModel.findById(id).exec();
  }

  async create(
    email: string,
    password: string,
    dateOfBirth?: Date,
    firstName?: string,
    lastName?: string,
  ): Promise<UserDocument> {
    const hashedPassword = await this.encryptionService.hash(password);
    const verificationToken = this.generateVerificationToken();
    
    const newUser = new this.userModel({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      dateOfBirth,
      emailVerified: false,
      emailVerificationToken: verificationToken,
    });

    return newUser.save();
  }

  /**
   * Find user by email verification token
   */
  async findByVerificationToken(token: string): Promise<UserDocument | undefined> {
    return this.userModel.findOne({ emailVerificationToken: token }).exec();
  }

  /**
   * Mark user's email as verified
   */
  async verifyEmail(userId: string): Promise<UserDocument | undefined> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          emailVerified: true,
          emailVerificationToken: null, // Clear the token after verification
        },
        { new: true }
      )
      .exec();
  }

  async update(
    id: string,
    updateData: Partial<{
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      dateOfBirth: Date;
    }>,
  ): Promise<UserDocument | undefined> {
    if (updateData.password) {
      updateData.password = await this.encryptionService.hash(updateData.password);
    }

    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<UserDocument | undefined> {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }
}
