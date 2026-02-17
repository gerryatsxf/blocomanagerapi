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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminOrTenantAdminGuard } from './guards/admin-or-tenant-admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MeetingService } from '../meeting/meeting.service';
import { Meeting, MeetingStatus } from '../meeting/entities/meeting.entity';
import { CreateMeetingDto } from '../meeting/dto/create-meeting.dto';
import { UpdateMeetingDto } from '../meeting/dto/update-meeting.dto';
import { Request } from 'express';
import { UserRole } from '../users/entities/user.entity';
import { GoogleOAuthService } from '../tenant/google-oauth.service';
import { GoogleCalendarProvider } from '../calendar/services/google-calendar.provider';
import { ConfigService } from '@nestjs/config';
import { WebhookSubscriptionService } from '../calendar/services/webhook-subscription.service';

@ApiTags('Admin - Meetings')
@Controller('admin/meetings')
@UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
@ApiBearerAuth()
export class AdminMeetingController {
  private readonly logger = new Logger(AdminMeetingController.name);

  constructor(
    private readonly meetingService: MeetingService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly webhookSubscriptionService: WebhookSubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all meetings for tenant' })
  async getAllMeetings(
    @Req() request: Request,
    @Query('status') status?: MeetingStatus,
  ): Promise<Meeting[]> {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    return this.meetingService.findAll(tenantId, status);
  }

  @Get('connection-status')
  @ApiOperation({ summary: 'Check Google Calendar webhook connection status' })
  async getConnectionStatus(@Req() request: Request) {
    const adminUser = request['adminUser'];
    
    if (!adminUser.tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Get first authenticated provider for this tenant
    const providers = await this.googleOAuthService.getAuthenticatedProviders(adminUser.tenant);
    
    if (providers.length === 0) {
      return {
        connected: false,
        needsReconnection: true,
        message: 'No Google Calendar connected',
        email: adminUser.email,
      };
    }

    const status = await this.webhookSubscriptionService.getConnectionStatus(
      adminUser.tenant,
      providers[0],
    );
    
    return { ...status, email: providers[0] };
  }

  @Post()
  @ApiOperation({ summary: 'Create new meeting' })
  async createMeeting(
    @Body() createMeetingDto: CreateMeetingDto,
    @Req() request: Request,
  ): Promise<Meeting> {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? createMeetingDto.tenantId
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    // Create meeting in database
    const meeting = await this.meetingService.create({
      ...createMeetingDto,
      tenantId,
    });

    // Sync to Google Calendar if connected
    try {
      await this.syncMeetingToProvider(meeting);
    } catch (error) {
      this.logger.warn(`Failed to sync meeting to calendar provider: ${error.message}`);
      // Continue even if sync fails - meeting is still created
    }

    return meeting;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific meeting' })
  async getMeeting(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Meeting> {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    return this.meetingService.findOne(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update meeting (reschedule)' })
  async updateMeeting(
    @Param('id') id: string,
    @Body() updateMeetingDto: UpdateMeetingDto,
    @Req() request: Request,
  ): Promise<Meeting> {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.body.tenantId
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    // Get meeting first
    const meeting = await this.meetingService.findOne(id, tenantId);

    // Update in database
    const updatedMeeting = await this.meetingService.update(
      id,
      tenantId,
      updateMeetingDto,
      false, // Don't sync yet
    );

    // Sync to calendar provider
    await this.syncMeetingToProvider(updatedMeeting);

    return updatedMeeting;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel meeting' })
  async deleteMeeting(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<{ success: boolean; message: string }> {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    const meeting = await this.meetingService.findOne(id, tenantId);

    // Delete from calendar provider first
    if (meeting.providerEventId && meeting.status === MeetingStatus.SYNCED) {
      await this.deleteFromProvider(meeting);
    }

    // Mark as cancelled in database
    await this.meetingService.delete(id, tenantId);

    return {
      success: true,
      message: 'Meeting cancelled successfully',
    };
  }

  private async syncMeetingToProvider(meeting: Meeting): Promise<void> {
    // NOTE: This method is deprecated - Meeting entity no longer contains business fields
    // Use AdminBookingController and VideoCallService instead for new implementations
    throw new Error('This method is deprecated. Use AdminBookingController for booking management.');
    
    /* DEPRECATED CODE - Meeting entity refactored to sync-only
    // Get OAuth tokens for this tenant
    const storedTokens = await this.googleOAuthService.getStoredTokens(meeting.tenantId);

    if (!storedTokens) {
      throw new NotFoundException('Google Calendar not connected');
    }

    // Create calendar provider
    const provider = new GoogleCalendarProvider(
      this.configService,
      storedTokens.tokens.access_token,
      storedTokens.tokens.refresh_token,
    );

    // If meeting is currently non-scheduled, create new event
    if (meeting.status === MeetingStatus.FAILED || !meeting.providerEventId) {
      const result = await provider.createEvent({
        title: '', // REMOVED FIELD
        description: '', // REMOVED FIELD
        startTime: new Date(), // REMOVED FIELD
        endTime: new Date(), // REMOVED FIELD
        attendees: [], // REMOVED FIELD
        location: '', // REMOVED FIELD
        reminders: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      });

      // Update meeting with provider event ID
      const meetingId = (meeting as any)._id.toString();
      await this.meetingService['meetingModel'].findByIdAndUpdate(meetingId, {
        providerEventId: result.eventId,
        status: MeetingStatus.SYNCED,
        lastSyncedAt: new Date(),
      });
    } else {
      // Update existing event
      await provider.updateEvent(meeting.providerEventId, {
        title: '', // REMOVED FIELD
        description: '', // REMOVED FIELD
        startTime: new Date(), // REMOVED FIELD
        endTime: new Date(), // REMOVED FIELD
        attendees: [], // REMOVED FIELD
        location: '', // REMOVED FIELD
      });
    }
    */
  }

  private async deleteFromProvider(meeting: Meeting): Promise<void> {
    const storedTokens = await this.googleOAuthService.getStoredTokens(meeting.tenantId);

    if (!storedTokens) {
      console.warn('No OAuth tokens found, cannot delete from provider');
      return;
    }

    const provider = new GoogleCalendarProvider(
      this.configService,
      storedTokens.tokens.access_token,
      storedTokens.tokens.refresh_token,
    );

    await provider.deleteEvent(meeting.providerEventId);
  }
}
