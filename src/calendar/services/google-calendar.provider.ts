import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import {
  ICalendarProvider,
  CalendarEvent,
  CalendarEventUpdate,
  WebhookSubscription,
} from '../interfaces/calendar-provider.interface';

@Injectable()
export class GoogleCalendarProvider implements ICalendarProvider {
  private oauth2Client: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly accessToken: string,
    private readonly refreshToken: string,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  async createEvent(event: CalendarEvent): Promise<{ eventId: string; event: CalendarEvent }> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: event.title,
        description: event.description,
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: 'America/Mexico_City',
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: 'America/Mexico_City',
        },
        attendees: event.attendees.map(a => ({
          email: a.email,
          displayName: a.name,
        })),
        location: event.location,
        conferenceData: event.conferenceData,
        reminders: event.reminders ? {
          useDefault: false,
          overrides: event.reminders.map(r => ({
            method: r.method,
            minutes: r.minutes,
          })),
        } : undefined,
      },
    });

    return {
      eventId: response.data.id,
      event: {
        ...event,
        id: response.data.id,
      },
    };
  }

  async updateEvent(eventId: string, updates: CalendarEventUpdate): Promise<{ eventId: string; event: CalendarEvent }> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const updatePayload: any = {};
    
    if (updates.title) updatePayload.summary = updates.title;
    if (updates.description) updatePayload.description = updates.description;
    if (updates.startTime) {
      updatePayload.start = {
        dateTime: updates.startTime.toISOString(),
        timeZone: 'America/Mexico_City',
      };
    }
    if (updates.endTime) {
      updatePayload.end = {
        dateTime: updates.endTime.toISOString(),
        timeZone: 'America/Mexico_City',
      };
    }
    if (updates.attendees) {
      updatePayload.attendees = updates.attendees.map(a => ({
        email: a.email,
        displayName: a.name,
      }));
    }
    if (updates.location) updatePayload.location = updates.location;

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all',
      requestBody: updatePayload,
    });

    // Fetch full event to return complete data
    const fullEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });

    return {
      eventId: response.data.id,
      event: this.mapGoogleEventToCalendarEvent(fullEvent.data),
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all',
    });
  }

  async getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items?.map(event => this.mapGoogleEventToCalendarEvent(event)) || [];
  }

  async subscribeToWebhooks(callbackUrl: string): Promise<WebhookSubscription> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    const channelId = `bloco-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const response = await calendar.events.watch({
      calendarId: 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: callbackUrl,
        expiration: (Date.now() + (7 * 24 * 60 * 60 * 1000)).toString(), // 7 days
      },
    });

    return {
      channelId: response.data.id,
      resourceId: response.data.resourceId,
      expiration: new Date(parseInt(response.data.expiration)),
    };
  }

  async unsubscribeFromWebhooks(channelId: string, resourceId: string): Promise<void> {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

    await calendar.channels.stop({
      requestBody: {
        id: channelId,
        resourceId: resourceId,
      },
    });
  }

  async renewWebhookSubscription(channelId: string, resourceId: string): Promise<WebhookSubscription> {
    // Google doesn't support renewal, must unsubscribe and resubscribe
    try {
      await this.unsubscribeFromWebhooks(channelId, resourceId);
    } catch (error) {
      // Channel might already be expired, continue
    }

    // Will need to pass callback URL from calling code
    throw new Error('renewWebhookSubscription must be called with callbackUrl parameter');
  }

  private mapGoogleEventToCalendarEvent(googleEvent: any): CalendarEvent {
    return {
      id: googleEvent.id,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description,
      startTime: new Date(googleEvent.start.dateTime || googleEvent.start.date),
      endTime: new Date(googleEvent.end.dateTime || googleEvent.end.date),
      attendees: (googleEvent.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName,
      })),
      location: googleEvent.location,
      conferenceData: googleEvent.conferenceData,
    };
  }
}
