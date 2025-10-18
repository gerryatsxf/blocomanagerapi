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
    // const headersRequest = {
    //   Authorization: `Bearer ${process.env.VONAGE_JWT_365_DAYS}`,
    // };

    return firstValueFrom(
      this.httpService
        .post(
          BASE_URL,
          { display_name: displayName },
          // { headers: headersRequest },
        )
        .pipe(
          tap((resp) => console.log(resp)),
          map((resp) => plainToInstance(CreateMeetingResultDto, resp.data)),
          tap((data) => console.log(data)),
        ),
    ).catch((err) => {
      console.log(err);
      throw err;
    });
  }
}
