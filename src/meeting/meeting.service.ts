import { Injectable } from '@nestjs/common';
import { CreateMeetingResultDto } from './dto/create-meeting-result.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map, tap } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import 'dotenv/config';
import * as path from 'path';
import CreateMeetingRequestDto from './dto/create-meeting-request.dto';

@Injectable()
export class MeetingService {
  constructor(private readonly httpService: HttpService) {}

  // async createTwilioMeeting(){
  //
  // }

  async createMeeting(
    displayName = 'BlocoManager - Espacio de reuniones',
  ): Promise<CreateMeetingResultDto> {
    const BASE_URL = process.env.CREATE_MEETING_URL;
    
    if (!BASE_URL) {
      throw new Error('CREATE_MEETING_URL environment variable is not defined');
    }

    return firstValueFrom(
      this.httpService
        .get(BASE_URL)
        .pipe(
          tap((resp) => console.log('Meeting creation response:', resp.data)),
          map((resp) => plainToInstance(CreateMeetingResultDto, resp.data)),
          tap((data) => console.log('Parsed meeting data:', data)),
        ),
    ).catch((err) => {
      console.error('Error creating meeting:', err.message);
      throw err;
    });
  }

  async createMeetingWithParams(
    timestamp: number,
    invitee: string,
    displayName = 'BlocoManager - Espacio de reuniones',
  ): Promise<CreateMeetingResultDto> {
    const BASE_URL = process.env.CREATE_MEETING_URL;
    
    if (!BASE_URL) {
      throw new Error('CREATE_MEETING_URL environment variable is not defined');
    }
    
    const url = `${BASE_URL}?timestamp=${timestamp}&invitee=${encodeURIComponent(invitee)}`;
    console.log('Creating meeting with URL:', url);
    
    return firstValueFrom(
      this.httpService
        .get(url)
        .pipe(
          tap((resp) => console.log('Meeting creation response:', resp.data)),
          tap((resp) => {
            console.log('=== Webhook Response Debug ===');
            console.log('Status:', resp.status);
            console.log('Raw response data:', resp.data);
            console.log('Raw response data type:', typeof resp.data);
            console.log('Raw response data stringified:', JSON.stringify(resp.data));
            console.log('=== End Webhook Debug ===');
          }),
          map((resp) => plainToInstance(CreateMeetingResultDto, resp.data)),
          tap((data) => console.log('Parsed meeting data:', data)),
        ),
    ).catch((err) => {
      console.error('Error creating meeting:', err.message);
      console.error('URL attempted:', url);
      throw err;
    });
  }
}
