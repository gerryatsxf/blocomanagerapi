export interface INylasEvent {
  end: number;
  start: number;
  title: string;
  location: string;
  description: string;
  calendarId: string;
  busy: boolean;
  participants: Array<{ name?: string; email: string }>;
  when: NylasEventWhen;
  metadata: NylasEventMetadata;
  notifications: Array<{
    type: string;
    minutesBeforeEvent: number;
    subject?: string;
    body?: string;
  }>;
  conferencing: any;
  save(options?: NylasEventSaveOptions): Promise<INylasEvent>;
}

interface NylasEventSaveOptions {
  notify_participants?: boolean;
}

interface NylasEventWhen {
  startTime?: number;
  start_time?: number;
  endTime?: number;
  end_time?: number;
}

interface NylasEventMetadata {
  event_type: string;
}
