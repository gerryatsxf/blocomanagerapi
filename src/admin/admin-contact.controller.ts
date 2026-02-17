import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOrTenantAdminGuard } from './guards/admin-or-tenant-admin.guard';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Admin - Contacts')
@Controller('admin/contacts')
@UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
@ApiBearerAuth()
export class AdminContactController {
  constructor(
    @InjectModel('CRMContact') private readonly contactModel: Model<any>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all contacts for tenant' })
  async getAllContacts(@Req() request: Request) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    return this.contactModel.find({ tenantId }).sort({ createdAt: -1 }).exec();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID' })
  async getContact(@Param('id') id: string, @Req() request: Request) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    const contact = await this.contactModel.findOne({ _id: id, tenantId }).exec();

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  @Post()
  @ApiOperation({ summary: 'Create new contact' })
  async createContact(@Body() createContactDto: any, @Req() request: Request) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? createContactDto.tenantId
      : adminUser.tenant;

    if (!tenantId) {
      throw new NotFoundException('Tenant ID required');
    }

    const contact = new this.contactModel({
      ...createContactDto,
      tenantId,
      createdBy: adminUser.email,
    });

    return contact.save();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact' })
  async updateContact(
    @Param('id') id: string,
    @Body() updateContactDto: any,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    const contact = await this.contactModel.findOne({ _id: id, tenantId }).exec();

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    Object.assign(contact, updateContactDto);
    contact.updatedBy = adminUser.email;
    contact.updatedAt = new Date();

    return contact.save();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete contact' })
  async deleteContact(@Param('id') id: string, @Req() request: Request) {
    const adminUser = request['adminUser'];
    const tenantId = adminUser.role === UserRole.SUPER_ADMIN
      ? request.query.tenantId as string
      : adminUser.tenant;

    const contact = await this.contactModel.findOne({ _id: id, tenantId }).exec();

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await this.contactModel.deleteOne({ _id: id }).exec();

    return {
      success: true,
      message: 'Contact deleted successfully',
    };
  }
}
