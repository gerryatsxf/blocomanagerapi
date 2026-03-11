import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarProvider } from '../enums/calendar-provider.enum';
import { ICalendarProvider } from '../interfaces/calendar-provider.interface';
import { GoogleCalendarProvider } from './google-calendar.provider';
import { OutlookCalendarProvider } from './outlook-calendar.provider';

export interface ProviderConfig {
  provider: CalendarProvider;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class CalendarProviderFactory {
  constructor(private readonly configService: ConfigService) {}

  createProvider(config: ProviderConfig): ICalendarProvider {
    switch (config.provider) {
      case CalendarProvider.GOOGLE:
        if (!config.accessToken || !config.refreshToken) {
          throw new Error('Google Calendar provider requires accessToken and refreshToken');
        }
        return new GoogleCalendarProvider(
          this.configService,
          config.accessToken,
          config.refreshToken,
        );

      case CalendarProvider.OUTLOOK:
        if (!config.accessToken || !config.refreshToken) {
          throw new Error('Outlook Calendar provider requires accessToken and refreshToken');
        }
        return new OutlookCalendarProvider(config.accessToken, config.refreshToken);

      default:
        throw new Error(`Unsupported calendar provider: ${config.provider}`);
    }
  }
}
