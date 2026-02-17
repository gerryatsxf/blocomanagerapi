import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOrTenantAdminGuard } from './guards/admin-or-tenant-admin.guard';
import { UserRole } from '../users/entities/user.entity';
import { VideoCallService } from '../meeting/services/video-call.service';
import { MeetingService } from '../meeting/meeting.service';
import { MeetingStatus } from '../meeting/entities/meeting.entity';
import { GoogleOAuthService } from '../tenant/google-oauth.service';
import { google } from 'googleapis';

@ApiTags('Admin - Bookings')
@Controller('admin/bookings')
@UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
@ApiBearerAuth()
export class AdminBookingController {
  private readonly logger = new Logger(AdminBookingController.name);

  constructor(
    @InjectModel('Booking') private readonly bookingModel: Model<any>,
    private readonly videoCallService: VideoCallService,
    private readonly meetingService: MeetingService,
    private readonly googleOAuthService: GoogleOAuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all bookings for tenant' })
  async getAllBookings(
    @Req() request: Request,
    @Query('status') status?: string,
  ) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    const query: any = { tenantId };
    if (status) {
      query.status = status;
    }

    return this.bookingModel
      .find(query)
      .sort({ meetingStartTimestamp: -1 })
      .exec();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific booking' })
  async getBooking(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    const booking = await this.bookingModel.findOne({ _id: id, tenantId }).exec();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  @Post()
  @ApiOperation({ summary: 'Create new booking' })
  async createBooking(
    @Body() createBookingDto: any,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? createBookingDto.tenantId
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    // Create booking
    const booking = new this.bookingModel({
      ...createBookingDto,
      tenantId,
    });

    await booking.save();

    return booking;
  }

  @Post(':id/sync-to-calendar')
  @ApiOperation({ summary: 'Sync booking to Google Calendar (without video call)' })
  async syncToCalendar(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    const booking = await this.bookingModel.findOne({ _id: id, tenantId }).exec();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check if meeting already exists
    if (booking.meetingId) {
      throw new BadRequestException('Booking already synced to calendar');
    }

    try {
      // Create calendar event without video call
      const result = await this.videoCallService.generateGoogleMeetLink({
        title: booking.title,
        description: booking.description,
        startTime: new Date(booking.meetingStartTimestamp),
        endTime: new Date(booking.meetingEndTimestamp),
        attendees: [
          { email: booking.customerEmail, name: booking.customerName },
        ],
        tenantId,
        skipConference: true, // Don't create Meet link
      });

      // Create Meeting entity for calendar sync tracking
      const meeting = await this.meetingService.create({
        bookingId: booking._id.toString(),
        tenantId,
        provider: 'google',
        status: MeetingStatus.SYNCED,
        providerEventId: result.eventId,
        syncDirection: 'outbound' as any,
        lastSyncedAt: new Date(),
      } as any);

      // Update booking with meeting reference
      booking.meetingId = (meeting as any)._id.toString();
      await booking.save();

      this.logger.log(`Synced booking ${id} to Google Calendar`);

      return {
        success: true,
        htmlLink: result.htmlLink,
        booking,
      };
    } catch (error) {
      this.logger.error('Failed to sync booking to calendar:', error);
      throw new BadRequestException('Failed to sync to calendar: ' + error.message);
    }
  }

  @Post(':id/generate-meet-link')
  @ApiOperation({ summary: 'Generate Google Meet link for booking' })
  async generateMeetLink(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    const booking = await this.bookingModel.findOne({ _id: id, tenantId }).exec();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check if booking already has a video call link
    if (booking.videoCallLink) {
      throw new BadRequestException('Booking already has a video call link');
    }

    try {
      let result;
      let meeting;

      // If booking already has a calendar event (meetingId exists), update it with Meet link
      if (booking.meetingId) {
        meeting = await this.meetingService.findOne(booking.meetingId, tenantId);
        
        if (meeting && meeting.providerEventId) {
          // Update existing calendar event to add Meet link
          result = await this.videoCallService.updateGoogleMeetEvent(
            meeting.providerEventId,
            {
              title: booking.title,
              description: booking.description,
              startTime: new Date(booking.meetingStartTimestamp),
              endTime: new Date(booking.meetingEndTimestamp),
              attendees: [
                { email: booking.customerEmail, name: booking.customerName },
              ],
              tenantId,
            }
          );
        } else {
          // Meeting entity exists but no calendar event, create new one
          result = await this.videoCallService.generateGoogleMeetLink({
            title: booking.title,
            description: booking.description,
            startTime: new Date(booking.meetingStartTimestamp),
            endTime: new Date(booking.meetingEndTimestamp),
            attendees: [
              { email: booking.customerEmail, name: booking.customerName },
            ],
            tenantId,
          });
          
          // Update meeting with new event ID
          meeting.providerEventId = result.eventId;
          meeting.status = MeetingStatus.SYNCED;
          meeting.lastSyncedAt = new Date();
          await (meeting as any).save();
        }
      } else {
        // No calendar event exists, create new one with Meet link
        result = await this.videoCallService.generateGoogleMeetLink({
          title: booking.title,
          description: booking.description,
          startTime: new Date(booking.meetingStartTimestamp),
          endTime: new Date(booking.meetingEndTimestamp),
          attendees: [
            { email: booking.customerEmail, name: booking.customerName },
          ],
          tenantId,
        });

        // Create Meeting entity for calendar sync tracking
        meeting = await this.meetingService.create({
          bookingId: booking._id.toString(),
          tenantId,
          provider: 'google',
          status: MeetingStatus.SYNCED,
          providerEventId: result.eventId,
          syncDirection: 'outbound' as any,
          lastSyncedAt: new Date(),
        } as any);

        booking.meetingId = (meeting as any)._id.toString();
      }

      // Update booking with video call info
      booking.videoCallLink = result.meetLink;
      booking.videoCallProvider = 'google-meet';
      await booking.save();

      this.logger.log(`Generated Google Meet link for booking ${id}: ${result.meetLink}`);

      return {
        success: true,
        meetLink: result.meetLink,
        htmlLink: result.htmlLink,
        booking,
      };
    } catch (error) {
      this.logger.error(`Failed to generate Meet link: ${error.message}`);
      throw new BadRequestException(`Failed to generate video call: ${error.message}`);
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update booking' })
  async updateBooking(
    @Param('id') id: string,
    @Body() updateBookingDto: any,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? updateBookingDto.tenantId
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    const booking = await this.bookingModel.findOne({ _id: id, tenantId }).exec();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Update booking
    Object.assign(booking, updateBookingDto);
    await booking.save();

    // If booking has a meeting and time changed, update the Google Calendar event
    if (booking.meetingId && 
        (updateBookingDto.meetingStartTimestamp || updateBookingDto.meetingEndTimestamp)) {
      try {
        const meeting = await this.meetingService.findOne(booking.meetingId, tenantId);
        
        if (meeting && meeting.providerEventId) {
          await this.videoCallService.updateGoogleMeetEvent(
            meeting.providerEventId,
            {
              title: booking.title,
              description: booking.description,
              startTime: new Date(booking.meetingStartTimestamp),
              endTime: new Date(booking.meetingEndTimestamp),
              attendees: [{ email: booking.customerEmail, name: booking.customerName }],
              tenantId,
            },
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to update calendar event: ${error.message}`);
      }
    }

    return booking;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete booking' })
  async deleteBooking(
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    const booking = await this.bookingModel.findOne({ _id: id, tenantId }).exec();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Delete Google Calendar event if exists
    if (booking.meetingId) {
      try {
        const meeting = await this.meetingService.findOne(booking.meetingId, tenantId);
        
        if (meeting && meeting.providerEventId) {
          await this.videoCallService.deleteGoogleMeetEvent(
            meeting.providerEventId,
            tenantId,
          );
        }

        // Delete meeting entity
        await this.meetingService.delete(booking.meetingId, tenantId);
      } catch (error) {
        this.logger.warn(`Failed to delete calendar event: ${error.message}`);
      }
    }

    await this.bookingModel.deleteOne({ _id: id }).exec();

    return {
      success: true,
      message: 'Booking deleted successfully',
    };
  }

  @Post('sync-from-calendar')
  async syncFromGoogleCalendar(@Req() req: any) {
    const adminUser = req['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? req.body.tenantId
      : adminUser.tenant;
    
    // Get OAuth credentials for this tenant
    const storedTokens = await this.googleOAuthService.getStoredTokens(tenantId);
    if (!storedTokens) {
      throw new NotFoundException('Google Calendar not connected');
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

    // Get all bookings with meetings for this tenant
    const bookings = await this.bookingModel.find({ 
      tenantId: tenantId,
      meetingId: { $exists: true, $ne: null }
    }).exec();

    let updated = 0;
    let deleted = 0;
    let unchanged = 0;
    const errors = [];

    for (const booking of bookings) {
      try {
        const meeting = await this.meetingService.findOne(booking.meetingId, tenantId);
        
        if (!meeting || !meeting.providerEventId) {
          unchanged++;
          continue;
        }

        try {
          // Fetch the event from Google Calendar
          const response = await calendar.events.get({
            calendarId: 'primary',
            eventId: meeting.providerEventId,
          });

          const event = response.data;
          
          // Parse timestamps from Google Calendar event
          const startTimestamp = new Date(event.start.dateTime || event.start.date).getTime();
          const endTimestamp = new Date(event.end.dateTime || event.end.date).getTime();

          // Check if times have changed
          if (booking.meetingStartTimestamp !== startTimestamp || 
              booking.meetingEndTimestamp !== endTimestamp) {
            
            booking.meetingStartTimestamp = startTimestamp;
            booking.meetingEndTimestamp = endTimestamp;
            await booking.save();
            updated++;
          } else {
            unchanged++;
          }
        } catch (calendarError: any) {
          // If event not found (404), mark as deleted
          if (calendarError.code === 404) {
            await this.meetingService.delete(booking.meetingId, tenantId);
            deleted++;
          } else {
            errors.push(`Booking ${booking._id}: ${calendarError.message}`);
            unchanged++;
          }
        }
      } catch (error: any) {
        errors.push(`Booking ${booking._id}: ${error.message}`);
        unchanged++;
      }
    }

    return {
      success: true,
      updated,
      deleted,
      unchanged,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
