import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailChange, EmailChangeStep } from './entities/email-change.schema';
import { EncryptionService } from '../encryption/encryption.service';
import * as crypto from 'crypto';

@Injectable()
export class EmailChangeService {
  constructor(
    @InjectModel(EmailChange.name)
    private readonly emailChangeModel: Model<EmailChange>,
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
   * Create a new email change request (Step 1)
   * Sends verification to current email
   */
  async createChangeRequest(
    userId: string,
    currentEmail: string,
  ): Promise<string> {
    // Invalidate any existing email change requests for this user
    await this.invalidateUserTokens(userId);

    // Generate token for current email verification
    const { plainToken, hashedToken } = await this.generateToken();

    // Calculate expiration (1 hour from now)
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Create email change document at step 1
    const emailChange = new this.emailChangeModel({
      userId,
      currentEmail,
      currentEmailToken: hashedToken,
      step: EmailChangeStep.VERIFY_CURRENT,
      expiresAt,
      createdAt: new Date(),
    });

    await emailChange.save();

    // Return plain token to send via email
    return plainToken;
  }

  /**
   * Find valid token for current email verification (Step 1 → Step 2 transition)
   */
  async findValidCurrentEmailToken(
    userId: string,
    plainToken: string,
  ): Promise<EmailChange | null> {
    // Find all non-expired tokens for this user at VERIFY_CURRENT step
    const emailChanges = await this.emailChangeModel
      .find({
        userId,
        step: EmailChangeStep.VERIFY_CURRENT,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!emailChanges || emailChanges.length === 0) {
      return null;
    }

    // Check each token using bcrypt compare
    for (const emailChange of emailChanges) {
      const isValid = await this.encryptionService.compare(
        plainToken,
        emailChange.currentEmailToken,
      );

      if (isValid) {
        return emailChange;
      }
    }

    return null;
  }

  /**
   * Update email change to step 2 (VERIFY_NEW)
   * Stores new email and generates token for new email verification
   */
  async updateToStepTwo(
    emailChangeId: string,
    newEmail: string,
  ): Promise<string> {
    // Generate token for new email verification
    const { plainToken, hashedToken } = await this.generateToken();

    // Update document to step 2
    await this.emailChangeModel.findByIdAndUpdate(emailChangeId, {
      newEmail,
      newEmailToken: hashedToken,
      step: EmailChangeStep.VERIFY_NEW,
      // Keep same expiration - user has remaining time from step 1
    });

    // Return plain token to send via email
    return plainToken;
  }

  /**
   * Find valid token for new email verification (Step 2 → Step 3 transition)
   */
  async findValidNewEmailToken(
    plainToken: string,
  ): Promise<EmailChange | null> {
    // Find all non-expired tokens at VERIFY_NEW step
    const emailChanges = await this.emailChangeModel
      .find({
        step: EmailChangeStep.VERIFY_NEW,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!emailChanges || emailChanges.length === 0) {
      return null;
    }

    // Check each token using bcrypt compare
    for (const emailChange of emailChanges) {
      if (!emailChange.newEmailToken) continue;

      const isValid = await this.encryptionService.compare(
        plainToken,
        emailChange.newEmailToken,
      );

      if (isValid) {
        return emailChange;
      }
    }

    return null;
  }

  /**
   * Complete email change (Step 3)
   * Marks the change as completed
   */
  async completeEmailChange(emailChangeId: string): Promise<void> {
    await this.emailChangeModel.findByIdAndUpdate(emailChangeId, {
      step: EmailChangeStep.COMPLETED,
    });
  }

  /**
   * Invalidate all email change tokens for a user
   * Used when starting a new email change request
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    await this.emailChangeModel.deleteMany({ userId });
  }

  /**
   * Check if an email is already being used in any pending email change
   */
  async isEmailPendingChange(email: string): Promise<boolean> {
    const pendingChange = await this.emailChangeModel.findOne({
      newEmail: email,
      step: { $in: [EmailChangeStep.VERIFY_CURRENT, EmailChangeStep.VERIFY_NEW] },
      expiresAt: { $gt: new Date() },
    });

    return !!pendingChange;
  }
}
