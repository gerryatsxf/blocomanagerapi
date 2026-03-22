import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service';
import BusySlotDto from './dto/busy-slot.dto';
import { GuestFreeSlotDto } from '../availability/dto/guest-free-slot.dto';
import FreeSlotDto from '../availability/dto/free-slot.dto';
import { plainToClass } from 'class-transformer';
import { WorkSlotDto } from '../availability/dto/work-slot.dto';
import { DateTimeDto } from '../date-time/dto/date-time.dto';
import { GoogleOAuthService } from '../tenant/google-oauth.service';
import { GoogleCalendarService } from '../tenant/google-calendar.service';

@Injectable()
export class FreeSlotService {
  private readonly logger = new Logger(FreeSlotService.name);

  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {}

  async getFreeSlots(tenantId: string, guestTimezone = 'America/Monterrey') {
    this.logger.log(`Getting free slots for tenant: ${tenantId}`);

    // Get tenant Google Calendar authentication
    const tokenData = await this.googleOAuthService.getStoredTokens(tenantId);
    if (!tokenData) {
      throw new BadRequestException(
        'Tenant not authenticated with Google Calendar. Please connect your Google Calendar in Settings.',
      );
    }

    this.logger.log(`Found Google Calendar auth for ${tokenData.userEmail}`);

    const workSlotsResult = await this.availabilityService.findWorkSlotsByTenant(tenantId);
    const workSlots = workSlotsResult.workSlots;

    // If no availability configured, return empty slots
    if (!workSlots || workSlots.length === 0) {
      return {
        guestTimezone: guestTimezone,
        guestTimezoneOffset: DateTimeDto.getTimezoneOffset(guestTimezone),
        freeSlots: [],
      };
    }

    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 60 * 60 * 24 * 30; // add 30 days in seconds

    // Prepare tokens in the format GoogleCalendarService expects (camelCase)
    const providerTokens = {
      accessToken: tokenData.tokens.access_token,
      refreshToken: tokenData.tokens.refresh_token,
      expiryDate: tokenData.tokens.expiry_date,
    };

    // Get busy slots using Google Calendar API
    let freeBusyData;
    try {
      freeBusyData = await this.googleCalendarService.getFreeBusy(
        providerTokens,
        new Date(startTime * 1000),
        new Date(endTime * 1000),
        [tokenData.userEmail],
      );
    } catch (error) {
      if (error.message?.includes('invalid_grant')) {
        throw new BadRequestException(
          'Google Calendar authorization has expired. The provider needs to reconnect their Google account.',
        );
      }
      throw error;
    }

    // Parse Google Calendar freebusy response (convert ISO strings to Unix timestamps)
    const busySlots: BusySlotDto[] = [];
    if (freeBusyData.calendars && freeBusyData.calendars[tokenData.userEmail]) {
      const calendarData = freeBusyData.calendars[tokenData.userEmail];
      if (calendarData.busy && Array.isArray(calendarData.busy)) {
        calendarData.busy.forEach((slot: any) => {
          busySlots.push(
            plainToClass(BusySlotDto, {
              startTime: Math.floor(new Date(slot.start).getTime() / 1000),
              endTime: Math.floor(new Date(slot.end).getTime() / 1000),
            }),
          );
        });
      }
    }

    this.logger.log(`Found ${busySlots.length} busy slots`);

    const nowInSeconds = Math.floor(Date.now() / 1000);

    // Filter work slots: keep only future slots and remove any that overlap with busy slots
    const freeSlots: FreeSlotDto[] = workSlots.filter((workSlot: WorkSlotDto) => {
      // Exclude past slots
      if (workSlot.startTime < nowInSeconds) {
        return false;
      }

      // Exclude slots that overlap with any busy slot
      return !busySlots.some((busySlot) => {
        return (
          // Work slot starts during a busy slot
          (workSlot.startTime >= busySlot.startTime &&
            workSlot.startTime < busySlot.endTime) ||
          // Work slot ends during a busy slot
          (workSlot.endTime > busySlot.startTime &&
            workSlot.endTime <= busySlot.endTime) ||
          // Work slot exactly matches a busy slot
          (workSlot.startTime === busySlot.startTime &&
            workSlot.endTime === busySlot.endTime) ||
          // Busy slot is fully contained within work slot
          (workSlot.startTime < busySlot.startTime &&
            workSlot.endTime > busySlot.endTime)
        );
      });
    });

    // Convert the free slots to the guest timezone
    const guestFreeSlots: GuestFreeSlotDto[] = freeSlots.map(
      (slot: FreeSlotDto) => {
        const guestSlot = new GuestFreeSlotDto();
        guestSlot.meetingStartTime = slot.startTime;
        const dateTime = DateTimeDto.timestampToDateTime(
          slot.startTime * 1000,
          guestTimezone,
        );

        guestSlot.guestMeetingDate = dateTime.strDate;
        guestSlot.guestMeetingStartTime = dateTime.strTime;
        guestSlot.meetingStartTime = slot.startTime;
        guestSlot.guestMeetingDay = dateTime.dayOfWeek;

        return guestSlot;
      },
    );

    return {
      guestTimezone: guestTimezone,
      guestTimezoneOffset: DateTimeDto.getTimezoneOffset(guestTimezone),
      freeSlots: guestFreeSlots,
    };
  }
}
