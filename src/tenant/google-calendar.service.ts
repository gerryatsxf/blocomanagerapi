import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Create a Google OAuth2 client with provider's tokens
   */
  private createOAuth2Client(tokens: any) {
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI')
    );

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate,
    });

    return oauth2Client;
  }

  /**
   * Create a calendar event in the provider's Google Calendar
   */
  async createEvent(
    providerTokens: any,
    eventData: {
      title: string;
      description?: string;
      startTime: Date | string;
      endTime: Date | string;
      attendees: Array<{ email: string; displayName?: string }>;
      meetingLink?: string;
      location?: string;
      timezone?: string;
    }
  ) {
    try {
      const oauth2Client = this.createOAuth2Client(providerTokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Convert timestamps to ISO strings if needed
      const startDateTime = typeof eventData.startTime === 'number' 
        ? new Date(eventData.startTime).toISOString()
        : eventData.startTime instanceof Date 
          ? eventData.startTime.toISOString()
          : eventData.startTime;
      
      const endDateTime = typeof eventData.endTime === 'number'
        ? new Date(eventData.endTime).toISOString()
        : eventData.endTime instanceof Date
          ? eventData.endTime.toISOString()
          : eventData.endTime;

      const event = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: startDateTime,
          timeZone: eventData.timezone || 'America/Mexico_City',
        },
        end: {
          dateTime: endDateTime,
          timeZone: eventData.timezone || 'America/Mexico_City',
        },
        attendees: eventData.attendees.map(attendee => ({
          email: attendee.email,
          displayName: attendee.displayName,
        })),
        location: eventData.location,
        conferenceData: eventData.meetingLink ? {
          createRequest: {
            requestId: `meeting-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        } : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 10 }, // 10 minutes before
          ],
        },
        // Automatically send invitations
        guestsCanInviteOthers: false,
        guestsCanModify: false,
        guestsCanSeeOtherGuests: true,
      };

      this.logger.log(`🗓️ Creating Google Calendar event: ${eventData.title}`);
      this.logger.log(`📧 Attendees: ${eventData.attendees.map(a => a.email).join(', ')}`);

      // First, let's verify calendar access and list calendars
      try {
        const calendarList = await calendar.calendarList.list();
        this.logger.log(`📅 Available calendars for user:`, calendarList.data.items?.map(cal => ({
          id: cal.id,
          summary: cal.summary,
          primary: cal.primary,
          accessRole: cal.accessRole,
        })));
      } catch (listError) {
        this.logger.warn(`⚠️ Could not list calendars: ${listError.message}`);
      }

      const response = await calendar.events.insert({
        calendarId: 'primary',
        sendUpdates: 'all', // Send email invitations to all attendees
        conferenceDataVersion: eventData.meetingLink ? 1 : undefined,
        requestBody: event,
      });

      this.logger.log(`✅ Event created successfully: ${response.data.id}`);
      this.logger.log(`🔗 Event link: ${response.data.htmlLink}`);
      this.logger.log(`📋 Full event response:`, {
        id: response.data.id,
        status: response.data.status,
        created: response.data.created,
        organizer: response.data.organizer,
        attendees: response.data.attendees,
        summary: response.data.summary,
        start: response.data.start,
        end: response.data.end,
      });

      return {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink,
        meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
        status: response.data.status,
        created: response.data.created,
        updated: response.data.updated,
        organizer: response.data.organizer,
        attendees: response.data.attendees,
      };
    } catch (error) {
      this.logger.error('❌ Error creating Google Calendar event:', error);
      throw new Error(`Failed to create calendar event: ${error.message}`);
    }
  }

  /**
   * Get calendar events for a provider
   */
  async getEvents(
    providerTokens: any,
    options: {
      startTime?: Date;
      endTime?: Date;
      maxResults?: number;
    } = {}
  ) {
    try {
      const oauth2Client = this.createOAuth2Client(providerTokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: options.startTime?.toISOString(),
        timeMax: options.endTime?.toISOString(),
        maxResults: options.maxResults || 10,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      this.logger.error('❌ Error fetching Google Calendar events:', error);
      throw new Error(`Failed to fetch calendar events: ${error.message}`);
    }
  }

  /**
   * Get free/busy information for a provider
   */
  async getFreeBusy(
    providerTokens: any,
    startTime: Date,
    endTime: Date,
    emails: string[]
  ) {
    try {
      const oauth2Client = this.createOAuth2Client(providerTokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          items: emails.map(email => ({ id: email })),
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('❌ Error fetching free/busy information:', error);
      throw new Error(`Failed to fetch free/busy information: ${error.message}`);
    }
  }

    /**
   * Test calendar access and return basic info
   */
  async testCalendarAccess(providerTokens: any) {
    try {
      const oauth2Client = this.createOAuth2Client(providerTokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Try to get calendar info
      const response = await calendar.calendars.get({
        calendarId: 'primary',
      });

      return {
        success: true,
        calendarId: response.data.id,
        summary: response.data.summary,
        timeZone: response.data.timeZone,
      };
    } catch (error) {
      this.logger.error('❌ Error testing calendar access:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}