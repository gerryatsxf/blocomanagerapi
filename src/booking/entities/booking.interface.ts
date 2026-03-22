import * as mongoose from 'mongoose';

export interface IBooking extends mongoose.Document {
  _links: any;
  _id: string;
  tenantId: string;
  meetingStartTimestamp: number;
  meetingEndTimestamp: number;
  sessionId: string;
  status: 'pending' | 'paid' | 'stale';
  type: 'tutoring' | 'consultancy';
  paymentExpirationTimestamp: number;
  guestTimezone: string;
  customerName: string;
  customerEmail: string;
  title: string;
  description?: string;
}
