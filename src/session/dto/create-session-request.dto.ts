import { SessionStatus, TenantVisitorStatus } from '../entities/session.interface';

export class CreateSessionRequestDto {
  timestamp: number;
  duration: number; // milliseconds
  timezone?: string;
  status?: SessionStatus;
  tenantVisitorStatus?: TenantVisitorStatus;
  leadId?: string
  leadStage?: string;
  tenant: string; // Required tenant identifier
}
