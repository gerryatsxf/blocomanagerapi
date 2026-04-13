import { Injectable } from '@nestjs/common';
import { CreateSessionRequestDto } from './dto/create-session-request.dto';
import { UpdateSessionRequestDto } from './dto/update-session-request.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ISession, SessionStatus, TenantVisitorStatus } from './entities/session.interface';
import { TenantService } from '../tenant/tenant.service';
import { PLATFORM_ID } from '../common/platform.constants';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel('Session') private readonly sessionModel: Model<ISession>,
    private readonly tenantService: TenantService,
  ) {}
  async create(tenant?: string): Promise<ISession> {
    const createSessionDto = new CreateSessionRequestDto();
    createSessionDto.timestamp = Date.now();
    createSessionDto.duration = 1000 * 60 * 60; // 1 hour in milliseconds
    createSessionDto.tenant = tenant || PLATFORM_ID; // Default tenant if not provided
    createSessionDto.status = SessionStatus.ACTIVE; // Set status to active

    const newSession = new this.sessionModel(createSessionDto);
    await newSession.save();

    return newSession;
  }

  async createLeadSession(leadId: string, tenant?: string): Promise<ISession> {
    const createSessionDto = new CreateSessionRequestDto();
    createSessionDto.timestamp = Date.now();
    createSessionDto.duration = 1000 * 60 * 60; // 1 hour in milliseconds
    createSessionDto.leadId = leadId;
    createSessionDto.leadStage = 'st_greet'; // Default to 's1' for lead stage
    createSessionDto.tenant = tenant || PLATFORM_ID; // Default tenant if not provided
    createSessionDto.status = SessionStatus.ACTIVE; // Set status to active
    createSessionDto.tenantVisitorStatus = TenantVisitorStatus.LEAD; // Set tenant visitor status to lead
    console.log({ createSessionDto });
    const newSession = new this.sessionModel(createSessionDto);
    await newSession.save();

    return newSession;
  }

  // findAll() {
  //   return `This action returns all session`;
  // }

  findOne(id: string) {
    return this.sessionModel.findById(id);
  }

  findByLeadId(leadId: string) {
    return this.sessionModel.findOne({ leadId });
  }

  update(id: string, updateSessionDto: Partial<UpdateSessionRequestDto>) {
    return this.sessionModel.findByIdAndUpdate(id, updateSessionDto, {
      new: true,
    });
  }

  async findByClientReferenceId(clientReferenceId: string) {
    return this.sessionModel.findOne({ clientReferenceId });
  }

  async revokeSession(id: string): Promise<ISession> {
    return this.sessionModel.findByIdAndUpdate(
      id,
      { status: SessionStatus.REVOKED },
      { new: true }
    );
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionModel.updateMany(
      { userId, status: SessionStatus.ACTIVE },
      { status: SessionStatus.REVOKED }
    );
  }

  async findByUserId(userId: string): Promise<ISession[]> {
    return this.sessionModel.find({ userId }).exec();
  }

  async findByTenant(tenant: string): Promise<ISession[]> {
    return this.sessionModel.find({ tenant }).exec();
  }

  async deleteSessionsByUserId(userId: string): Promise<void> {
    await this.sessionModel.deleteMany({ userId }).exec();
  }

  // remove(id: number) {
  //   return `This action removes a #${id} session`;
  // }
}
