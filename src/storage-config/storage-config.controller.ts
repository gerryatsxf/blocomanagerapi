import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformOwnerGuard } from '../admin/guards/platform-owner.guard';
import { StorageConfigService } from './storage-config.service';
import { CreateStorageConfigDto, UpdateStorageConfigDto } from './dto/storage-config.dto';
import { StorageProviderLabels, StorageProviderType } from './schemas/storage-config.schema';

@ApiTags('Storage Config')
@Controller('admin/storage-configs')
@UseGuards(JwtAuthGuard, PlatformOwnerGuard)
@ApiBearerAuth()
export class StorageConfigController {
  constructor(private readonly storageConfigService: StorageConfigService) {}

  @Get('providers')
  @ApiOperation({ summary: 'Get available storage provider types with labels' })
  getProviders() {
    return Object.entries(StorageProviderLabels).map(([value, label]) => ({
      value,
      label,
    }));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new storage configuration' })
  @ApiResponse({ status: 201, description: 'Storage config created' })
  async create(@Body() dto: CreateStorageConfigDto) {
    return this.storageConfigService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all storage configurations' })
  async findAll() {
    return this.storageConfigService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a storage configuration by ID' })
  async findOne(@Param('id') id: string) {
    return this.storageConfigService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a storage configuration' })
  async update(@Param('id') id: string, @Body() dto: UpdateStorageConfigDto) {
    return this.storageConfigService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a storage configuration' })
  async remove(@Param('id') id: string) {
    await this.storageConfigService.remove(id);
    return { success: true, message: 'Storage configuration deleted' };
  }
}
