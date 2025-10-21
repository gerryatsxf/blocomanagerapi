import * as mongoose from 'mongoose';

export interface ISession extends mongoose.Document {
  _id: string;
  leadId?: string;
  leadStage?: string;
  timestamp: number;
  duration: number;
  timezone?: string;
  tenant: string; // Required tenant identifier

  status?: string;

  processingTimestamp?: number;

  clientReferenceId?: string;
  // authenticityToken: string;
}
