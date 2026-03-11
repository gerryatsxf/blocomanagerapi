import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MeetingDocument = Meeting & Document;

export enum MeetingStatus {
  PENDING = 'pending',       // Waiting to sync
  SYNCED = 'synced',         // Successfully synced
  FAILED = 'failed',         // Sync failed
  DELETED = 'deleted',       // Deleted from provider
}

export enum SyncDirection {
  OUTBOUND = 'outbound', // Created/updated in our system, synced to provider
  INBOUND = 'inbound',   // Created/updated in provider, synced to our system
}

@Schema({ timestamps: true })
export class Meeting {
  @Prop({ required: true, index: true })
  bookingId: string;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true, enum: ['google', 'outlook'] })
  provider: string;

  @Prop({ index: true })
  providerEventId: string;

  @Prop({ required: true, enum: Object.values(MeetingStatus), index: true })
  status: MeetingStatus;

  @Prop({ enum: Object.values(SyncDirection) })
  syncDirection: SyncDirection;

  @Prop({ type: Date })
  lastSyncedAt: Date;

  @Prop()
  syncToken: string; // For incremental sync

  @Prop()
  syncError: string; // Last sync error message if any
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);

// Compound indexes
MeetingSchema.index({ tenantId: 1, bookingId: 1 });
MeetingSchema.index({ tenantId: 1, providerEventId: 1 });
MeetingSchema.index({ tenantId: 1, status: 1 });
