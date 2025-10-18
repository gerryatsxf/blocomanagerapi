export interface NylasCalendar {
  id: string;
  name: string;
  description?: string;
  timezone?: string;
  isPrimary?: boolean;
  isOwned?: boolean;
  metadata?: Record<string, any>;
}