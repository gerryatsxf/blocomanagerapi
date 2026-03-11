import { Injectable } from '@nestjs/common';
import { DateTimeDto } from '../date-time/dto/date-time.dto';

@Injectable()
export class CalendarService {
  getTimezoneList(): string[] {
    return DateTimeDto.getTimeZoneList();
  }
}
