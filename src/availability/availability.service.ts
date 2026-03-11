import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkSlot } from './entities/availability.entity';
import { TenantAvailability, TenantAvailabilityDocument } from './schemas/tenant-availability.schema';

function prependZero(time: number): string {
  return time < 10 ? `0${time}` : `${time}`;
}

function getTimezoneOffsetHours(timezone: string): number {
  // Use Intl to get the actual offset for the given timezone
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (tzPart) {
      // Parse "GMT-6" or "GMT+5:30" etc
      const match = tzPart.value.match(/GMT([+-]?)(\d+)(?::(\d+))?/);
      if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const hours = parseInt(match[2], 10);
        const minutes = match[3] ? parseInt(match[3], 10) : 0;
        return sign * (hours + minutes / 60);
      }
    }
  } catch (e) {
    // fallback
  }
  return -6; // default to CST
}

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(TenantAvailability.name)
    private tenantAvailabilityModel: Model<TenantAvailabilityDocument>,
  ) {}

  /**
   * Get or create availability config for a tenant
   */
  async getAvailability(tenantId: string): Promise<TenantAvailability | null> {
    return this.tenantAvailabilityModel.findOne({ tenantId }).exec();
  }

  /**
   * Save availability config for a tenant (upsert)
   */
  async saveAvailability(
    tenantId: string,
    data: {
      timezone?: string;
      sessionDuration?: number;
      availableDays?: string[];
      availableHours?: { startTime: string; endTime: string }[];
    },
  ): Promise<TenantAvailability> {
    // Validate session duration
    if (data.sessionDuration && ![30, 45, 60, 90].includes(data.sessionDuration)) {
      throw new BadRequestException('Session duration must be 30, 45, 60, or 90 minutes.');
    }

    // Validate days
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (data.availableDays) {
      for (const day of data.availableDays) {
        if (!validDays.includes(day.toLowerCase())) {
          throw new BadRequestException(`Invalid day: ${day}`);
        }
      }
      data.availableDays = data.availableDays.map((d) => d.toLowerCase());
    }

    // Validate and check overlapping hours
    if (data.availableHours && data.availableHours.length > 0) {
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      for (const range of data.availableHours) {
        if (!timeRegex.test(range.startTime) || !timeRegex.test(range.endTime)) {
          throw new BadRequestException(
            `Invalid time format: ${range.startTime} - ${range.endTime}. Use HH:MM (24h).`,
          );
        }
        if (range.startTime >= range.endTime) {
          throw new BadRequestException(
            `Start time (${range.startTime}) must be before end time (${range.endTime}).`,
          );
        }
      }

      // Check for overlapping ranges
      const sorted = [...data.availableHours].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].startTime < sorted[i - 1].endTime) {
          throw new BadRequestException(
            `Overlapping time ranges: ${sorted[i - 1].startTime}-${sorted[i - 1].endTime} and ${sorted[i].startTime}-${sorted[i].endTime}`,
          );
        }
      }
    }

    const result = await this.tenantAvailabilityModel.findOneAndUpdate(
      { tenantId },
      { tenantId, ...data },
      { upsert: true, new: true },
    );
    return result;
  }

  /**
   * Build work slots from tenant availability config (DB-backed).
   * Returns an array of WorkSlot objects with Unix timestamps for the next 5 days.
   */
  async findWorkSlotsByTenant(tenantId: string): Promise<{ timezone: string; workSlots: WorkSlot[] }> {
    const config = await this.getAvailability(tenantId);

    if (!config || !config.availableDays || config.availableDays.length === 0 || !config.availableHours || config.availableHours.length === 0) {
      return { timezone: 'America/Monterrey', workSlots: [] };
    }

    const timezone = config.timezone || 'America/Monterrey';
    const sessionDuration = config.sessionDuration || 30;
    const offsetHours = getTimezoneOffsetHours(timezone);

    const workSlots: WorkSlot[] = [];

    // Generate slots for the next 30 days
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      // Use the tenant's timezone to determine the local date and day-of-week
      const now = new Date();
      now.setDate(now.getDate() + dayOffset);

      // Get the day-of-week in the tenant's timezone
      const localDayName = now.toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: timezone,
      }).toLowerCase();

      if (!config.availableDays.includes(localDayName)) {
        continue;
      }

      // Get the local date parts in the tenant's timezone
      const localParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      // en-CA gives YYYY-MM-DD format
      const strDate = localParts;
      const [year, month, day] = strDate.split('-');

      for (const hourRange of config.availableHours) {
        // Split the hour range into session-duration-sized slots
        const [startH, startM] = hourRange.startTime.split(':').map(Number);
        const [endH, endM] = hourRange.endTime.split(':').map(Number);
        const rangeStartMinutes = startH * 60 + startM;
        const rangeEndMinutes = endH * 60 + endM;

        for (let slotStart = rangeStartMinutes; slotStart + sessionDuration <= rangeEndMinutes; slotStart += sessionDuration) {
          const slotEnd = slotStart + sessionDuration;
          const slotStartH = Math.floor(slotStart / 60);
          const slotStartM = slotStart % 60;
          const slotEndH = Math.floor(slotEnd / 60);
          const slotEndM = slotEnd % 60;

          const startTimeStr = `${prependZero(slotStartH)}:${prependZero(slotStartM)}`;
          const endTimeStr = `${prependZero(slotEndH)}:${prependZero(slotEndM)}`;

          const absOffset = Math.abs(offsetHours);
          const offsetSign = offsetHours >= 0 ? '+' : '-';
          const offsetStr = `${offsetSign}${prependZero(Math.floor(absOffset))}:${prependZero((absOffset % 1) * 60)}`;

          const startStrDateTime = `${strDate}T${startTimeStr}:00.000${offsetStr}`;
          const endStrDateTime = `${strDate}T${endTimeStr}:00.000${offsetStr}`;

          const startDateTime = new Date(startStrDateTime);
          const endDateTime = new Date(endStrDateTime);

          const workSlot = new WorkSlot();
          workSlot.localTimezoneDate = strDate;
          workSlot.day = localDayName;
          workSlot.startTime = Math.floor(startDateTime.getTime() / 1000);
          workSlot.endTime = Math.floor(endDateTime.getTime() / 1000);
          workSlot.startDateTime = startDateTime;
          workSlot.endDateTime = endDateTime;
          workSlots.push(workSlot);
        }
      }
    }

    return { timezone, workSlots };
  }

  /**
   * Get the date string for the next occurrence of a given day of week
   */
  getDateOfNextDayOfWeek(dayOfWeek: string): string {
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayOfWeek = new Date().getDay();
    const targetDayOfWeekIndex = daysOfWeek.indexOf(dayOfWeek.toLowerCase());
    const daysUntilTargetDay = (targetDayOfWeekIndex + 7 - currentDayOfWeek) % 7;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysUntilTargetDay);

    const day = prependZero(targetDate.getDate());
    const month = prependZero(targetDate.getMonth() + 1);
    const year = targetDate.getFullYear();

    return `${year}-${month}-${day}`;
  }
}
