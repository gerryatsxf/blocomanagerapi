export interface NylasFreeBusyResponse {
  email: string;
  timeSlots: Array<{
    startTime: number;
    endTime: number;
    status: 'busy' | 'free';
  }>;
}