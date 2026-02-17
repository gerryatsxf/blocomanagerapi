import { Schema } from 'mongoose';

export const CRMContactSchema = new Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    type: {
      type: String,
      enum: ['customer', 'lead', 'partner', 'other'],
      default: 'customer',
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: String,
    },
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
CRMContactSchema.index({ tenantId: 1, email: 1 });
CRMContactSchema.index({ tenantId: 1, type: 1 });
