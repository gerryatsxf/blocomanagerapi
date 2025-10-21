import { PartialType } from '@nestjs/swagger';
import { CreateSessionRequestDto } from './create-session-request.dto';

export class UpdateSessionRequestDto extends PartialType(
  CreateSessionRequestDto,
) {
  status: string;
  processingTimestamp: number;
  clientReferenceId: string;
  tenant?: string; // Allow tenant updates if needed
}
