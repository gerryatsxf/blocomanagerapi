import * as mongoose from 'mongoose';

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
