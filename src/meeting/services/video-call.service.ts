import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from '../../tenant/google-oauth.service';

export interface VideoCallConfig {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees: Array<{ email: string; name?: string }>;
  tenantId: string;
  skipConference?: boolean; // If true, don't create video conference
}

export interface VideoCallResult {
  meetLink?: string; // Optional - only present when conference is created
  eventId: string;
  htmlLink: string;
}

@Injectable()
export class VideoCallService {
  private readonly logger = new Logger(VideoCallService.name);

  constructor(
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  /**
   * Generate a Google Meet link by creating a calendar event
   */
  async generateGoogleMeetLink(config: VideoCallConfig): Promise<VideoCallResult> {
    try {
      // Get OAuth tokens for tenant
      const storedTokens = await this.googleOAuthService.getStoredTokens(config.tenantId);
      
      if (!storedTokens) {
        throw new Error('Google Calendar not connected for this tenant');
      }

      // Create OAuth2 client - use GOOGLE_EMAIL_CLIENT_ID for calendar operations
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_EMAIL_CLIENT_ID,
        process.env.GOOGLE_EMAIL_CLIENT_SECRET,
        process.env.GOOGLE_EMAIL_REDIRECT_URI,
      );

      oauth2Client.setCredentials({
        access_token: storedTokens.tokens.access_token,
        refresh_token: storedTokens.tokens.refresh_token,
      });

      // Create calendar API instance
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Format attendees
      const attendeesList = config.attendees.map(att => ({
        email: att.email,
        displayName: att.name,
      }));

      // Create event object
      const event: any = {
        summary: config.title,
        description: config.description,
        start: {
          dateTime: config.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: config.endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: attendeesList,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
      };

      // Only add conference data if skipConference is not true
      if (!config.skipConference) {
        event.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        };
      }

      const insertOptions: any = {
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all', // Send email invitations to attendees
      };

      // Only set conferenceDataVersion if we're creating a conference
      if (!config.skipConference) {
        insertOptions.conferenceDataVersion = 1;
      }

      const response = await calendar.events.insert(insertOptions);

      const createdEvent = response.data;

      // hangoutLink is only present if conference was created
      if (!config.skipConference && !createdEvent.hangoutLink) {
        throw new Error('Failed to generate Google Meet link');
      }

      if (createdEvent.hangoutLink) {
        this.logger.log(`Generated Google Meet link for booking: ${createdEvent.hangoutLink}`);
      } else {
        this.logger.log(`Created calendar event without video conference: ${createdEvent.id}`);
      }

      return {
        meetLink: createdEvent.hangoutLink || undefined,
        eventId: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
      };
    } catch (error) {
      this.logger.error(`Failed to generate Google Meet link: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing Google Meet event
   */
  async updateGoogleMeetEvent(
    eventId: string,
    config: VideoCallConfig,
  ): Promise<VideoCallResult> {
    try {
      const storedTokens = await this.googleOAuthService.getStoredTokens(config.tenantId);
      
      if (!storedTokens) {
        throw new Error('Google Calendar not connected for this tenant');
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_EMAIL_CLIENT_ID,
        process.env.GOOGLE_EMAIL_CLIENT_SECRET,
        process.env.GOOGLE_EMAIL_REDIRECT_URI,
      );

      oauth2Client.setCredentials({
        access_token: storedTokens.tokens.access_token,
        refresh_token: storedTokens.tokens.refresh_token,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const attendeesList = config.attendees.map(att => ({
        email: att.email,
        displayName: att.name,
      }));

      const event = {
        summary: config.title,
        description: config.description,
        start: {
          dateTime: config.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: config.endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: attendeesList,
      };

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: event,
        sendUpdates: 'all',
      });

      const updatedEvent = response.data;

      return {
        meetLink: updatedEvent.hangoutLink || '',
        eventId: updatedEvent.id,
        htmlLink: updatedEvent.htmlLink,
      };
    } catch (error) {
      this.logger.error(`Failed to update Google Meet event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a Google Meet event
   */
  async deleteGoogleMeetEvent(eventId: string, tenantId: string): Promise<void> {
    try {
      const storedTokens = await this.googleOAuthService.getStoredTokens(tenantId);
      
      if (!storedTokens) {
        throw new Error('Google Calendar not connected for this tenant');
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_EMAIL_CLIENT_ID,
        process.env.GOOGLE_EMAIL_CLIENT_SECRET,
        process.env.GOOGLE_EMAIL_REDIRECT_URI,
      );

      oauth2Client.setCredentials({
        access_token: storedTokens.tokens.access_token,
        refresh_token: storedTokens.tokens.refresh_token,
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all',
      });

      this.logger.log(`Deleted Google Meet event: ${eventId}`);
    } catch (error) {
      this.logger.error(`Failed to delete Google Meet event: ${error.message}`);
      throw error;
    }
  }
}
