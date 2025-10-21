import * as mongoose from 'mongoose';
export const SessionSchema = new mongoose.Schema({
  timestamp: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  timezone: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    required: false,
  },
  processingTimestamp: {
    type: Number,
    required: false,
  },
  clientReferenceId: {
    type: String,
    required: false,
  },
  leadId: {
    type: String,
    required: false,
  },
  leadStage: {
    type: String,
    required: false,
  },
  tenant: {
    type: String,
    required: true,
    index: true, // Add index for efficient tenant-based queries
  },
  
  // authenticityToken: {
  //   type: String,
  //   required: false,
  // },
});
