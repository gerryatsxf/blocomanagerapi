import { PartialType } from '@nestjs/swagger';
import { CreateSessionRequestDto } from './create-session-request.dto';
import { SessionStatus, TenantVisitorStatus } from '../entities/session.interface';

export class UpdateSessionRequestDto extends PartialType(
  CreateSessionRequestDto,
) {
  status?: SessionStatus;
  tenantVisitorStatus?: TenantVisitorStatus;
  processingTimestamp?: number;
  clientReferenceId?: string;
  userId?: string; // Allow associating a user with the session
  tenant?: string; // Allow tenant updates if needed
}
