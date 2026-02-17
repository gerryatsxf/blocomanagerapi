import { Injectable } from '@nestjs/common';
import {
  ICalendarProvider,
  CalendarEvent,
  CalendarEventUpdate,
  WebhookSubscription,
} from '../interfaces/calendar-provider.interface';

@Injectable()
export class OutlookCalendarProvider implements ICalendarProvider {
  constructor(
    private readonly accessToken: string,
    private readonly refreshToken: string,
  ) {}

  async createEvent(event: CalendarEvent): Promise<{ eventId: string; event: CalendarEvent }> {
    throw new Error('Outlook Calendar provider not yet implemented');
  }

  async updateEvent(eventId: string, updates: CalendarEventUpdate): Promise<{ eventId: string; event: CalendarEvent }> {
    throw new Error('Outlook Calendar provider not yet implemented');
  }

  async deleteEvent(eventId: string): Promise<void> {
    throw new Error('Outlook Calendar provider not yet implemented');
  }

  async getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    throw new Error('Outlook Calendar provider not yet implemented');
  }

  async subscribeToWebhooks(callbackUrl: string): Promise<WebhookSubscription> {
    throw new Error('Outlook Calendar provider not yet implemented');
  }

  async unsubscribeFromWebhooks(channelId: string, resourceId: string): Promise<void> {
    throw new Error('Outlook Calendar provider not yet implemented');
  }

  async renewWebhookSubscription(channelId: string, resourceId: string): Promise<WebhookSubscription> {
    throw new Error('Outlook Calendar provider not yet implemented');
  }
}
