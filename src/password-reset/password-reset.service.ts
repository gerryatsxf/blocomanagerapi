import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPasswordReset } from './entities/password-reset.interface';
import { EncryptionService } from '../encryption/encryption.service';
import * as crypto from 'crypto';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel('PasswordReset')
    private readonly passwordResetModel: Model<IPasswordReset>,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Generate a secure random token
   * Returns both plain and hashed versions
   */
  async generateToken(): Promise<{ plainToken: string; hashedToken: string }> {
    // Generate 32 random bytes = 64 character hex string
    const plainToken = crypto.randomBytes(32).toString('hex');
    
    // Hash the token before storing
    const hashedToken = await this.encryptionService.hash(plainToken);
    
    return { plainToken, hashedToken };
  }

  /**
   * Create a new password reset request
   */
  async createResetToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    // Invalidate any existing tokens for this user
    await this.invalidateUserTokens(userId);

    // Generate new token
    const { plainToken, hashedToken } = await this.generateToken();

    // Calculate expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Create password reset document
    const passwordReset = new this.passwordResetModel({
      userId,
      token: hashedToken,
      expiresAt,
      used: false,
      createdAt: new Date(),
      ipAddress,
      userAgent,
    });

    await passwordReset.save();

    // Return the plain token (to be sent via email)
    return plainToken;
  }

  /**
   * Find password reset by token and validate it
   */
  async findValidToken(plainToken: string): Promise<IPasswordReset | null> {
    // Hash the incoming token
    const hashedToken = await this.encryptionService.hash(plainToken);

    // Find the token
    const passwordReset = await this.passwordResetModel.findOne({
      token: hashedToken,
    });

    if (!passwordReset) {
      return null;
    }

    // Check if already used
    if (passwordReset.used) {
      return null;
    }

    // Check if expired
    if (new Date() > passwordReset.expiresAt) {
      return null;
    }

    return passwordReset;
  }

  /**
   * Mark a token as used
   */
  async markTokenAsUsed(tokenId: string): Promise<void> {
    await this.passwordResetModel.findByIdAndUpdate(tokenId, {
      used: true,
      usedAt: new Date(),
    });
  }

  /**
   * Invalidate all tokens for a specific user
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    await this.passwordResetModel.updateMany(
      { userId, used: false },
      { used: true, usedAt: new Date() },
    );
  }

  /**
   * Get password reset history for a user (for analytics/auditing)
   */
  async getUserResetHistory(userId: string): Promise<IPasswordReset[]> {
    return this.passwordResetModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
  }

  /**
   * Count active (unused, unexpired) tokens for a user
   */
  async countActiveTokens(userId: string): Promise<number> {
    return this.passwordResetModel.countDocuments({
      userId,
      used: false,
      expiresAt: { $gt: new Date() },
    });
  }
}
