import * as mongoose from 'mongoose';

export enum SessionStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum TenantVisitorStatus {
  LEAD = 'lead',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  AUTHENTICATED = 'authenticated',
}

export interface ISession extends mongoose.Document {
  _id: string;
  leadId?: string;
  leadStage?: string;
  userId?: string; // Reference to User when session becomes authenticated
  timestamp: number;
  duration: number;
  timezone?: string;
  tenant: string; // Required tenant identifier

  status: SessionStatus;
  tenantVisitorStatus?: TenantVisitorStatus;

  processingTimestamp?: number;

  clientReferenceId?: string;
  // authenticityToken: string;
}
