import { Controller, Post, Body, Headers, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MeetingService } from '../meeting/meeting.service';
import { MeetingStatus } from '../meeting/entities/meeting.entity';
import { GoogleCalendarProvider } from './services/google-calendar.provider';
import { GoogleOAuthService } from '../tenant/google-oauth.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Calendar Webhooks')
@Controller('calendar/webhooks')
export class CalendarWebhookController {
  private readonly logger = new Logger(CalendarWebhookController.name);

  constructor(
    @Inject(forwardRef(() => MeetingService))
    private readonly meetingService: MeetingService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('google')
  @ApiOperation({ summary: 'Google Calendar webhook endpoint' })
  async handleGoogleWebhook(
    @Headers() headers: any,
    @Body() body: any,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log('Received Google Calendar webhook');

    // Google sends notifications with specific headers
    const resourceState = headers['x-goog-resource-state'];
    const resourceId = headers['x-goog-resource-id'];
    const channelId = headers['x-goog-channel-id'];

    if (!resourceState || !resourceId || !channelId) {
      throw new BadRequestException('Missing required Google webhook headers');
    }

    // Handle sync notification (initial verification)
    if (resourceState === 'sync') {
      this.logger.log('Webhook sync notification received');
      return { success: true, message: 'Sync acknowledged' };
    }

    // Handle exists notification (something changed)
    if (resourceState === 'exists') {
      this.logger.log(`Processing calendar changes for channel: ${channelId}`);
      
      try {
        await this.processCalendarChanges(channelId, resourceId);
        return { success: true, message: 'Changes processed' };
      } catch (error) {
        this.logger.error('Failed to process calendar changes:', error);
        throw error;
      }
    }

    return { success: true, message: 'Notification received' };
  }

  private async processCalendarChanges(channelId: string, resourceId: string): Promise<void> {
    // Find the tenant and user associated with this webhook
    const oauthToken = await this.googleOAuthService.findByWebhookChannel(channelId);
    
    if (!oauthToken) {
      this.logger.warn(`No OAuth token found for channel: ${channelId}`);
      return;
    }

    // Create calendar provider
    const provider = new GoogleCalendarProvider(
      this.configService,
      oauthToken.accessToken,
      oauthToken.refreshToken,
    );

    // Fetch recent events to detect changes
    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3); // Look 3 months ahead

    try {
      const events = await provider.getEvents(now, futureDate);

      // Get all synced meetings for this tenant
      const meetings = await this.meetingService.findAll(
        oauthToken.tenantId,
        MeetingStatus.SYNCED,
      );

      // Create a map of providerEventId -> meeting
      const meetingMap = new Map(
        meetings.map(m => [m.providerEventId, m]),
      );

      // Check each meeting to see if it still exists in Google Calendar
      for (const meeting of meetings) {
        if (!meeting.providerEventId) continue;

        const calendarEvent = events.find(e => e.id === meeting.providerEventId);

        if (!calendarEvent) {
          // Event was deleted in Google Calendar
          this.logger.log(
            `Event ${meeting.providerEventId} deleted from Google Calendar, marking as non-scheduled`,
          );
          await this.meetingService.markAsNonScheduled(
            (meeting as any)._id.toString(),
            oauthToken.tenantId,
          );
        } else {
          // Meeting entity only tracks sync status, not event details
          // Event modifications should be handled at the Booking level
          this.logger.log(
            `Event ${meeting.providerEventId} still exists in Google Calendar`,
          );
          
          // Update last sync timestamp
          await this.meetingService.updateFromWebhook(
            oauthToken.tenantId,
            meeting.providerEventId,
            {
              lastSyncedAt: new Date(),
            },
          );
        }
      }

      // Check for new events created in Google Calendar (not in our system)
      for (const event of events) {
        if (!meetingMap.has(event.id)) {
          // This is a new event created in Google Calendar
          // For now, we'll just log it - you might want to create a meeting record
          this.logger.log(
            `New event ${event.id} found in Google Calendar: ${event.title}`,
          );
          // Could optionally create a meeting record here
        }
      }
    } catch (error) {
      this.logger.error('Error processing calendar changes:', error);
      throw error;
    }
  }
}
