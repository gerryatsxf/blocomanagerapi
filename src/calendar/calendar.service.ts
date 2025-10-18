import { Injectable } from '@nestjs/common';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { NylasFreeBusy } from './entities/nylas-free-busy.entity';
import { DateTimeDto } from '../date-time/dto/date-time.dto';
import { INylasEvent } from './dto/nylas-event.interface';
import { BuildEventParamsDto } from './dto/build-event-params.dto';
import { ScheduleEventParamsDto } from './dto/schedule-event-params.dto';
import { NylasService } from '../nylas/nylas.service';

const kebabCase = (s: string) =>
  s
    .normalize('NFD') // split an accented letter in the base letter and the accent
    .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
    .replace(/([a-z])([A-Z])/g, '$1-$2') // split camelCase
    .replace(/[\s_]+/g, '-') // replace all spaces and low dash
    .toLowerCase(); // convert to lower case

@Injectable()
export class CalendarService {
  constructor(private readonly nylasService: NylasService) {}
  create(createCalendarDto: CreateCalendarDto) {
    return this.nylasService.createCalendar({
      name: createCalendarDto.name,
      description: createCalendarDto.description,
      timezone: 'America/Monterrey',
      metadata: {
        keyname: kebabCase(createCalendarDto.name),
      },
    });
  }

  getTimezoneList(): string[] {
    return DateTimeDto.getTimeZoneList();
  }

  findAll() {
    return this.nylasService.getCalendars();
  }

  getCalendarByName(keyname: string) {
    return this.nylasService.getCalendarByKeyname(keyname);
  }

  getPrimaryCalendar() {
    return this.nylasService.getPrimaryCalendar();
  }

  findOne(id: string) {
    return this.nylasService.getCalendar(id);
  }

  update(id: string, updateCalendarDto: UpdateCalendarDto) {
    return this.nylasService.updateCalendar(id, {
      name: updateCalendarDto.name,
      description: updateCalendarDto.description,
      metadata: {
        keyname: kebabCase(updateCalendarDto.name),
      },
    });
  }

  remove(id: string) {
    return this.nylasService.deleteCalendar(id);
  }

  async getFreeBusy(
    startTime: number,
    endTime: number,
    emails: string[],
  ): Promise<any> {
    return await this.nylasService.getFreeBusy({
      startTime: startTime,
      endTime: endTime,
      emails: emails,
    });
  }

  async buildEvent(params: BuildEventParamsDto): Promise<any> {
    const primaryCalendar = await this.nylasService.getPrimaryCalendar();
    
    const eventData = {
      title: params.title,
      description: params.description,
      startTime: params.eventStartTime,
      endTime: params.eventEndTime,
      participants: [
        {
          name: params.customerName,
          email: params.customerEmail,
        },
      ],
      calendarId: primaryCalendar?.id,
      busy: true,
      metadata: { event_type: params.eventType },
      notifications: [
        {
          type: 'email',
          minutesBeforeEvent: 600,
          subject: 'Test Event Notification',
          body: 'Reminding you about our meeting.',
        },
      ],
    };

    return eventData;
  }

  getNotificationBody(guestName, meetingLink) {
    return `
        Hola, ${guestName}
        \n<br>
        \n<br> Nos da mucho gusto saludarte. 
        \n<br>
        \n<br> Te damos una cálido bienvenida de parte de aprendecoding.com :) 
        \n<br> Has agendado una sesión de asesoría para el XX de XX del XXXX a las XX:XX pm. 
        \n<br> Más abajo te compartimos el link de la reunión. 
        \n<br> Te esperamos! 
        \n<br>
        \n<br> Link de videollamada: ${meetingLink}
        \n<br>
        \n<br> Atentamente, 
        \n<br> aprendecoding.com`;
  }

  async scheduleEvent(scheduleEventParamsDto: ScheduleEventParamsDto) {
    // Create a new event
    const eventData = {
      title: scheduleEventParamsDto.title,
      description: scheduleEventParamsDto.description,
      startTime: scheduleEventParamsDto.eventStartTime,
      endTime: scheduleEventParamsDto.eventEndTime,
      participants: [
        {
          name: scheduleEventParamsDto.customerName,
          email: scheduleEventParamsDto.customerEmail,
        },
      ],
      busy: true,
      metadata: { event_type: scheduleEventParamsDto.meetingType },
      notifications: [
        {
          type: 'email',
          minutesBeforeEvent: 600,
          subject: 'Test Event Notification',
          body: 'Reminding you about our meeting.',
        },
      ],
      notifyParticipants: true,
    };

    const event = await this.nylasService.createEvent(eventData);
    console.log(event);
    return event;
  }
}
