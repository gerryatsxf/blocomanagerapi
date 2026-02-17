export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees: Array<{
    email: string;
    name?: string;
  }>;
  location?: string;
  conferenceData?: any;
  reminders?: Array<{
    method: 'email' | 'popup';
    minutes: number;
  }>;
}

export interface CalendarEventUpdate {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  attendees?: Array<{
    email: string;
    name?: string;
  }>;
  location?: string;
}

export interface WebhookSubscription {
  channelId: string;
  resourceId: string;
  expiration: Date;
}

export interface ICalendarProvider {
  /**
   * Create a new calendar event
   */
  createEvent(event: CalendarEvent): Promise<{ eventId: string; event: CalendarEvent }>;

  /**
   * Update an existing calendar event
   */
  updateEvent(eventId: string, updates: CalendarEventUpdate): Promise<{ eventId: string; event: CalendarEvent }>;

  /**
   * Delete a calendar event
   */
  deleteEvent(eventId: string): Promise<void>;

  /**
   * Get events in a date range
   */
  getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]>;

  /**
   * Subscribe to webhook notifications for calendar changes
   */
  subscribeToWebhooks(callbackUrl: string): Promise<WebhookSubscription>;

  /**
   * Unsubscribe from webhook notifications
   */
  unsubscribeFromWebhooks(channelId: string, resourceId: string): Promise<void>;

  /**
   * Renew webhook subscription
   */
  renewWebhookSubscription(channelId: string, resourceId: string): Promise<WebhookSubscription>;
}
