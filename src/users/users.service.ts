import { Injectable, ConflictException } from '@nestjs/common';
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
    companyName?: string,
    role?: string,
  ): Promise<UserDocument> {
    // Check if email already exists
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('An account with this email address already exists. Please use a different email or try logging in.');
    }

    const hashedPassword = await this.encryptionService.hash(password);
    const verificationToken = this.generateVerificationToken();
    
    const newUser = new this.userModel({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      dateOfBirth,
      companyName,
      role: role || 'user',
      emailVerified: false,
      emailVerificationToken: verificationToken,
    });

    try {
      return await newUser.save();
    } catch (error) {
      // Handle MongoDB duplicate key error (race condition)
      if (error.code === 11000) {
        throw new ConflictException('An account with this email address already exists. Please use a different email or try logging in.');
      }
      throw error;
    }
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
      role: string;
      tenant: string;
      companyName: string;
      lastLoginAt: Date;
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
