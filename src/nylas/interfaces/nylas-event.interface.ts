export interface NylasEvent {
  id?: string;
  title: string;
  description?: string;
  when: {
    startTime: number;
    endTime: number;
  };
  participants?: Array<{
    name?: string;
    email: string;
  }>;
  conferencing?: {
    provider: string;
    details: {
      url?: string;
      meetingCode?: string;
      password?: string;
      phone?: string[];
    };
  };
  calendarId?: string;
  busy?: boolean;
  metadata?: Record<string, any>;
  notifications?: Array<{
    type: string;
    minutesBeforeEvent: number;
    subject?: string;
    body?: string;
  }>;
}