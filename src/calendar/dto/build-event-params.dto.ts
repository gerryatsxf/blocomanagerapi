export class BuildEventParamsDto {
  title: string;
  location: string;
  description: string;
  // calendarId: string;
  busy: boolean;
  participants: Array<{ name?: string; email: string }>;
  conferencing: any;

  calendarName: string;

  eventStartTime: number;
  eventEndTime: number;
  eventType: string;

  customerName: string;
  customerEmail: string;
  guestMeetingLink: string;
  hostMeetingLink: string;
}
