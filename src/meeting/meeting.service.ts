import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map, tap } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { Meeting, MeetingDocument, MeetingStatus, SyncDirection } from './entities/meeting.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { CreateMeetingResultDto } from './dto/create-meeting-result.dto';
import 'dotenv/config';

@Injectable()
export class MeetingService {
  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Meeting.name)
    private readonly meetingModel: Model<MeetingDocument>,
  ) {}

  // ============================================================================
  // LEGACY METHODS - Keep for backward compatibility with existing booking system
  // ============================================================================

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
        .get(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          responseType: 'json'
        })
        .pipe(
          tap((resp) => console.log('Meeting creation response:', resp.data)),
          map((resp) => plainToInstance(CreateMeetingResultDto, resp.data)),
          tap((data) => console.log('Parsed meeting data:', data)),
        ),
    ).catch((err) => {
      console.error('Error creating meeting:', err.message);
      console.error('URL attempted:', url);
      throw err;
    });
  }

  async createMeetingRoom(dto: any): Promise<CreateMeetingResultDto> {
    return this.createMeetingWithParams(dto.timestamp, dto.invitee);
  }

  // ============================================================================
  // NEW CALENDAR SYNC METHODS
  // ============================================================================

  async create(createMeetingDto: CreateMeetingDto): Promise<Meeting> {
    const meeting = new this.meetingModel({
      ...createMeetingDto,
      status: MeetingStatus.PENDING,
      syncDirection: SyncDirection.OUTBOUND,
      lastSyncedAt: new Date(),
    });

    return meeting.save();
  }

  async findAll(tenantId: string, status?: MeetingStatus): Promise<Meeting[]> {
    const query: any = { tenantId };
    if (status) {
      query.status = status;
    }

    return this.meetingModel
      .find(query)
      .sort({ startTime: -1 })
      .exec();
  }

  async findOne(id: string, tenantId: string): Promise<Meeting> {
    const meeting = await this.meetingModel.findOne({ _id: id, tenantId }).exec();

    if (!meeting) {
      throw new Error(`Meeting with ID ${id} not found`);
    }

    return meeting;
  }

  async findByProviderEventId(tenantId: string, providerEventId: string): Promise<Meeting | null> {
    return this.meetingModel.findOne({ tenantId, providerEventId }).exec();
  }

  async update(
    id: string,
    tenantId: string,
    updateMeetingDto: UpdateMeetingDto,
    syncToProvider = true,
  ): Promise<Meeting> {

    const updateData: any = {
      ...updateMeetingDto,
      lastSyncedAt: new Date(),
      syncDirection: SyncDirection.OUTBOUND,
    };

    // Note: Status updates should be handled explicitly by the caller
    // Meeting entity no longer has startTime/endTime fields

    const meeting = await this.meetingModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updateData },
      { new: true },
    ).exec();

    if (!meeting) {
      throw new Error(`Meeting with ID ${id} not found`);
    }

    return meeting;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const meeting = await this.meetingModel.findOneAndUpdate(
      { _id: id, tenantId },
      {
        $set: {
          status: MeetingStatus.DELETED,
          lastSyncedAt: new Date(),
        },
      },
    ).exec();

    if (!meeting) {
      throw new Error(`Meeting with ID ${id} not found`);
    }
  }

  async markAsNonScheduled(id: string, tenantId: string): Promise<Meeting> {
    const meeting = await this.meetingModel.findOneAndUpdate(
      { _id: id, tenantId },
      {
        $set: {
          status: MeetingStatus.FAILED,
          providerEventId: null,
          lastSyncedAt: new Date(),
          syncDirection: SyncDirection.INBOUND,
        },
      },
      { new: true },
    ).exec();

    if (!meeting) {
      throw new Error(`Meeting with ID ${id} not found`);
    }

    return meeting;
  }

  async updateFromWebhook(
    tenantId: string,
    providerEventId: string,
    updates: Partial<Meeting>,
  ): Promise<Meeting> {
    const meeting = await this.meetingModel
      .findOneAndUpdate(
        { tenantId, providerEventId },
        {
          $set: {
            ...updates,
            lastSyncedAt: new Date(),
            syncDirection: SyncDirection.INBOUND,
          },
        },
        { new: true },
      )
      .exec();

    if (!meeting) {
      throw new Error(
        `Meeting with providerEventId ${providerEventId} not found`,
      );
    }

    return meeting;
  }
}
