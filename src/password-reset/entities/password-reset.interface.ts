import * as mongoose from 'mongoose';
import { PasswordResetType } from './password-reset.schema';

export interface IPasswordReset extends mongoose.Document {
  _id: string;
  userId: string;              // Reference to User
  token: string;               // Hashed reset token
  type: PasswordResetType;     // forgot-password or change-password
  expiresAt: Date;            // Expiration timestamp
  used: boolean;              // Has been used?
  usedAt?: Date;             // When was it used?
  createdAt: Date;           // When requested
  ipAddress?: string;        // Request IP address
  userAgent?: string;        // Request user agent
}
