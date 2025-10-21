export class CreateSessionRequestDto {
  timestamp: number;
  duration: number; // milliseconds
  timezone?: string;
  status = 'lead';
  leadId?: string
  leadStage = 'st_greet'; // Default to 's1' for lead stage
  tenant: string; // Required tenant identifier
}
