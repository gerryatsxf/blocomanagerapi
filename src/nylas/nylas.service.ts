import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Nylas from 'nylas';

@Injectable()
export class NylasService {
  private readonly logger = new Logger(NylasService.name);
  private nylas: Nylas;
  private readonly grantId: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('NYLAS_MAIN_ACCOUNT_API_KEY');
    const grantId = this.configService.get<string>('NYLAS_MAIN_ACCOUNT_GRANT_ID');
    const apiUrl = this.configService.get<string>('NYLAS_API_URL') || 'https://api.us.nylas.com';

    if (!apiKey || !grantId) {
      throw new Error('Nylas API key and Grant ID are required');
    }

    this.nylas = new Nylas({
      apiKey: apiKey,
      apiUri: apiUrl,
    });

    this.grantId = grantId;
    this.logger.log('Nylas service initialized with modern SDK');
  }

  /**
   * Get all calendars for the grant
   */
  async getCalendars() {
    try {
      const response = await this.nylas.calendars.list({
        identifier: this.grantId,
      });
      
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching calendars:', error);
      throw error;
    }
  }

  /**
   * Get a specific calendar by ID
   */
  async getCalendar(calendarId: string) {
    try {
      const calendar = await this.nylas.calendars.find({
        identifier: this.grantId,
        calendarId,
      });

      return calendar.data;
    } catch (error) {
      this.logger.error(`Error fetching calendar ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Get the primary calendar
   */
  async getPrimaryCalendar() {
    try {
      const calendars = await this.getCalendars();
      return calendars.find((calendar: any) => calendar.isPrimary) || null;
    } catch (error) {
      this.logger.error('Error fetching primary calendar:', error);
      throw error;
    }
  }

  /**
   * Find calendar by metadata keyname
   */
  async getCalendarByKeyname(keyname: string) {
    try {
      const calendars = await this.getCalendars();
      return calendars.find((calendar: any) => 
        calendar.metadata && calendar.metadata.keyname === keyname
      ) || null;
    } catch (error) {
      this.logger.error(`Error fetching calendar by keyname ${keyname}:`, error);
      throw error;
    }
  }

  /**
   * Create a new calendar
   */
  async createCalendar(calendarData: {
    name: string;
    description?: string;
    timezone?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const calendar = await this.nylas.calendars.create({
        identifier: this.grantId,
        requestBody: {
          name: calendarData.name,
          description: calendarData.description,
          timezone: calendarData.timezone || 'America/Monterrey',
          metadata: calendarData.metadata,
        },
      });

      return calendar.data;
    } catch (error) {
      this.logger.error('Error creating calendar:', error);
      throw error;
    }
  }

  /**
   * Update a calendar
   */
  async updateCalendar(calendarId: string, updateData: {
    name?: string;
    description?: string;
    timezone?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const calendar = await this.nylas.calendars.update({
        identifier: this.grantId,
        calendarId,
        requestBody: updateData,
      });

      return calendar.data;
    } catch (error) {
      this.logger.error(`Error updating calendar ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a calendar
   */
  async deleteCalendar(calendarId: string): Promise<void> {
    try {
      await this.nylas.calendars.destroy({
        identifier: this.grantId,
        calendarId,
      });
    } catch (error) {
      this.logger.error(`Error deleting calendar ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Get free/busy information
   */
  async getFreeBusy(params: {
    startTime: number;
    endTime: number;
    emails: string[];
  }) {
    try {
      const response = await this.nylas.calendars.getFreeBusy({
        identifier: this.grantId,
        requestBody: {
          startTime: params.startTime,
          endTime: params.endTime,
          emails: params.emails,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error fetching free/busy information:', error);
      throw error;
    }
  }

  /**
   * Create a new event
   */
  async createEvent(eventData: {
    title: string;
    description?: string;
    startTime: number;
    endTime: number;
    participants?: Array<{ name?: string; email: string; status?: string }>;
    conferencing?: any;
    calendarId?: string;
    busy?: boolean;
    metadata?: Record<string, any>;
    notifications?: Array<{
      type: string;
      minutesBeforeEvent: number;
      subject?: string;
      body?: string;
    }>;
    notifyParticipants?: boolean;
  }) {
    try {
      const calendarId = eventData.calendarId || (await this.getPrimaryCalendar())?.id;
      
      if (!calendarId) {
        throw new Error('No calendar ID provided and no primary calendar found');
      }

      const event = await this.nylas.events.create({
        identifier: this.grantId,
        requestBody: {
          title: eventData.title,
          description: eventData.description,
          when: {
            startTime: eventData.startTime,
            endTime: eventData.endTime,
          },
          participants: eventData.participants?.map(p => ({
            name: p.name,
            email: p.email,
            status: (p.status as any) || 'noreply'
          })),
          conferencing: eventData.conferencing,
          calendarId,
          busy: eventData.busy ?? true,
          metadata: eventData.metadata,
        },
        queryParams: {
          calendarId,
          notifyParticipants: eventData.notifyParticipants ?? false,
        },
      });

      return event.data;
    } catch (error) {
      this.logger.error('Error creating event:', error);
      throw error;
    }
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string) {
    try {
      const event = await this.nylas.events.find({
        identifier: this.grantId,
        eventId,
        queryParams: {
          calendarId: (await this.getPrimaryCalendar())?.id || ''
        }
      });

      return event.data;
    } catch (error) {
      this.logger.error(`Error fetching event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Update an event
   */
  async updateEvent(eventId: string, updateData: {
    title?: string;
    description?: string;
    startTime?: number;
    endTime?: number;
    participants?: Array<{ name?: string; email: string; status?: string }>;
    conferencing?: any;
    calendarId?: string;
    busy?: boolean;
    metadata?: Record<string, any>;
    notifications?: Array<{
      type: string;
      minutesBeforeEvent: number;
      subject?: string;
      body?: string;
    }>;
    notifyParticipants?: boolean;
  }) {
    try {
      const updateBody: any = {};
      
      if (updateData.title) updateBody.title = updateData.title;
      if (updateData.description) updateBody.description = updateData.description;
      if (updateData.startTime && updateData.endTime) {
        updateBody.when = {
          startTime: updateData.startTime,
          endTime: updateData.endTime,
        };
      }
      if (updateData.participants) {
        updateBody.participants = updateData.participants.map(p => ({
          name: p.name,
          email: p.email,
          status: p.status || 'noreply'
        }));
      }
      if (updateData.conferencing) updateBody.conferencing = updateData.conferencing;
      if (updateData.calendarId) updateBody.calendarId = updateData.calendarId;
      if (updateData.busy !== undefined) updateBody.busy = updateData.busy;
      if (updateData.metadata) updateBody.metadata = updateData.metadata;
      if (updateData.notifications) updateBody.notifications = updateData.notifications;

      const event = await this.nylas.events.update({
        identifier: this.grantId,
        eventId,
        requestBody: updateBody,
        queryParams: {
          calendarId: updateData.calendarId || (await this.getPrimaryCalendar())?.id,
          notifyParticipants: updateData.notifyParticipants ?? false,
        },
      });

      return event.data;
    } catch (error) {
      this.logger.error(`Error updating event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, notifyParticipants: boolean = false): Promise<void> {
    try {
      await this.nylas.events.destroy({
        identifier: this.grantId,
        eventId,
        queryParams: {
          calendarId: (await this.getPrimaryCalendar())?.id,
          notifyParticipants,
        },
      });
    } catch (error) {
      this.logger.error(`Error deleting event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Utility method to convert kebab case string
   */
  static toKebabCase(str: string): string {
    return str
      .normalize('NFD') // split accented letters
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/([a-z])([A-Z])/g, '$1-$2') // split camelCase
      .replace(/[\s_]+/g, '-') // replace spaces and underscores
      .toLowerCase();
  }
}