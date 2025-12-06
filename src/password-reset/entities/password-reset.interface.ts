import * as mongoose from 'mongoose';

export interface IPasswordReset extends mongoose.Document {
  _id: string;
  userId: string;              // Reference to User
  token: string;               // Hashed reset token
  expiresAt: Date;            // Expiration timestamp
  used: boolean;              // Has been used?
  usedAt?: Date;             // When was it used?
  createdAt: Date;           // When requested
  ipAddress?: string;        // Request IP address
  userAgent?: string;        // Request user agent
}
