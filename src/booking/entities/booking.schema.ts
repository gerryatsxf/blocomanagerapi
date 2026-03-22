import * as mongoose from 'mongoose';
import { PaymentStatusEnum } from '../../payment/payment-status.enum';

export const BookingSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
    description: 'The tenant ID for multi-tenant support',
  },
  meetingStartTimestamp: {
    type: Number,
    required: true,
    description: 'The start timestamp of the meeting',
  },
  meetingEndTimestamp: {
    type: Number,
    required: true,
    description: 'The end timestamp of the meeting',
  },
  sessionId: {
    type: String,
    required: true,
    description: 'The session ID related to the booking',
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(PaymentStatusEnum),
    description: 'The payment/booking status',
  },
  type: {
    type: String,
    required: false,
    enum: ['tutoring', 'consultancy'],
    description: 'The type of booking (optional)',
  },
  paymentExpirationTimestamp: {
    type: Number,
    required: true,
    description: 'The expiration timestamp of the payment for the booking',
  },
  guestTimezone: {
    type: String,
    required: true,
    description: 'The timezone of the guest',
  },
  customerName: {
    type: String,
    required: false,
    description: 'Guest/customer name',
  },
  customerEmail: {
    type: String,
    required: false,
    description: 'Guest/customer email',
  },
  title: {
    type: String,
    required: false,
    description: 'Booking title',
  },
  description: {
    type: String,
    description: 'Booking notes or description',
  },
  location: {
    type: String,
    description: 'Physical location or how to meet',
  },
  videoCallLink: {
    type: String,
    description: 'Generated video call link (Google Meet, Zoom, etc.)',
  },
  videoCallProvider: {
    type: String,
    enum: ['google-meet', 'zoom', 'custom'],
    description: 'Video call provider used',
  },
  meetingId: {
    type: String,
    index: true,
    description: 'Reference to Meeting entity for calendar sync',
  },
  paymentId: {
    type: String,
    index: true,
    description: 'Reference to Payment entity',
  },
  productId: {
    type: String,
    description: 'Reference to Product/Service booked',
  },
}, {
  timestamps: true,
});

// Indexes
BookingSchema.index({ tenantId: 1, status: 1 });
BookingSchema.index({ tenantId: 1, meetingStartTimestamp: 1 });
BookingSchema.index({ customerEmail: 1 });
