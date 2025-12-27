import * as mongoose from 'mongoose';

export enum PasswordResetType {
  FORGOT_PASSWORD = 'forgot-password',
  CHANGE_PASSWORD = 'change-password',
}

export const PasswordResetSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true, // Index for fast user lookups
  },
  token: {
    type: String,
    required: true,
    index: true, // Index for fast token lookups
    unique: true, // Each token must be unique
  },
  type: {
    type: String,
    enum: Object.values(PasswordResetType),
    required: true,
    default: PasswordResetType.FORGOT_PASSWORD,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true, // Index for TTL and expiration checks
  },
  used: {
    type: Boolean,
    required: true,
    default: false,
  },
  usedAt: {
    type: Date,
    required: false,
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  ipAddress: {
    type: String,
    required: false,
  },
  userAgent: {
    type: String,
    required: false,
  },
});

// TTL index - MongoDB will automatically delete documents 1 hour after expiresAt
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
