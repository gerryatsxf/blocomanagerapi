import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOrTenantAdminGuard } from '../admin/guards/admin-or-tenant-admin.guard';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { UserRole } from '../users/entities/user.entity';
import { StorageConfigService } from '../storage-config/storage-config.service';
import { StorageServiceFactory } from './services/storage.service';

@ApiTags('Templates')
@Controller('admin/templates')
@UseGuards(JwtAuthGuard, AdminOrTenantAdminGuard)
@ApiBearerAuth()
export class TemplateController {
  private readonly logger = new Logger(TemplateController.name);

  constructor(
    private readonly templateService: TemplateService,
    private readonly storageConfigService: StorageConfigService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create or update template for tenant' })
  async createTemplate(@Body() createTemplateDto: CreateTemplateDto, @Req() request: Request) {
    const adminUser = request['adminUser'];
    
    // Ensure tenant admins can only create templates for their own tenant
    if (adminUser.role !== UserRole.SUPER_ADMIN && createTemplateDto.templateTenant !== adminUser.tenant) {
      return {
        success: false,
        message: 'Cannot create template for another tenant',
      };
    }

    return this.templateService.create(createTemplateDto);
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Get all templates for a tenant' })
  async getTemplates(@Param('tenantId') tenantId: string, @Req() request: Request) {
    const adminUser = request['adminUser'];
    
    // Validate tenant access
    if (adminUser.role !== UserRole.SUPER_ADMIN && adminUser.tenant !== tenantId) {
      return {
        success: false,
        message: 'Cannot view templates for another tenant',
      };
    }

    return this.templateService.findByTenant(tenantId);
  }

  @Post(':tenantId/upload-image')
  @ApiOperation({ summary: 'Upload logo or profile image for tenant' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files are allowed'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @Param('tenantId') tenantId: string,
    @Body('imageType') imageType: string,
    @UploadedFile() file: any,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    
    // Validate tenant access
    if (adminUser.role !== UserRole.SUPER_ADMIN && adminUser.tenant !== tenantId) {
      return {
        success: false,
        message: 'Cannot upload image for another tenant',
      };
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!['logo', 'profile'].includes(imageType)) {
      throw new BadRequestException('imageType must be either "logo" or "profile"');
    }

    // Get the correct storage service for this tenant
    const { provider, config } = await this.storageConfigService.getConfigForTenant(tenantId);
    const storageService = StorageServiceFactory.create(provider, config);
    this.logger.log(`Uploading ${imageType} for tenant ${tenantId} via ${provider}`);

    const filename = await storageService.uploadFile(file, tenantId, imageType);
    const fileUrl = storageService.getFileUrl(filename);

    return {
      success: true,
      message: 'Image uploaded successfully',
      imageType,
      url: fileUrl,
      filename,
      provider,
    };
  }

  @Get(':tenantId/images')
  @ApiOperation({ summary: 'Get uploaded images for tenant' })
  async getImages(@Param('tenantId') tenantId: string, @Req() request: Request) {
    const adminUser = request['adminUser'];
    
    // Validate tenant access
    if (adminUser.role !== UserRole.SUPER_ADMIN && adminUser.tenant !== tenantId) {
      return {
        success: false,
        message: 'Cannot view images for another tenant',
      };
    }

    const { provider, config } = await this.storageConfigService.getConfigForTenant(tenantId);
    const storageService = StorageServiceFactory.create(provider, config);
    const images: Record<string, string | null> = { logo: null, profile: null };

    try {
      const files = await storageService.listFiles(tenantId);
      const logoFile = files.find((f) => f.includes(`${tenantId}_logo`));
      if (logoFile) images.logo = storageService.getFileUrl(logoFile);

      const profileFile = files.find((f) => f.includes(`${tenantId}_profile`));
      if (profileFile) images.profile = storageService.getFileUrl(profileFile);
    } catch (error) {
      this.logger.warn(`Failed to list images for tenant ${tenantId}: ${error.message}`);
    }

    return images;
  }

  @Delete(':tenantId/images/:imageType')
  @ApiOperation({ summary: 'Delete logo or profile image for tenant' })
  async deleteImage(
    @Param('tenantId') tenantId: string,
    @Param('imageType') imageType: string,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    
    // Validate tenant access
    if (adminUser.role !== UserRole.SUPER_ADMIN && adminUser.tenant !== tenantId) {
      return {
        success: false,
        message: 'Cannot delete image for another tenant',
      };
    }

    if (!['logo', 'profile'].includes(imageType)) {
      throw new BadRequestException('imageType must be either "logo" or "profile"');
    }

    const { provider, config } = await this.storageConfigService.getConfigForTenant(tenantId);
    const storageService = StorageServiceFactory.create(provider, config);

    try {
      const files = await storageService.listFiles(tenantId);
      const imageFile = files.find((f) => f.includes(`${tenantId}_${imageType}`));

      if (imageFile) {
        await storageService.deleteFile(imageFile);
        return {
          success: true,
          message: `${imageType === 'logo' ? 'Logo' : 'Profile photo'} deleted successfully`,
        };
      } else {
        return { success: false, message: 'Image not found' };
      }
    } catch (error) {
      throw new BadRequestException(`Failed to delete image: ${error.message}`);
    }
  }

  @Get(':tenantId/:slug')
  @ApiOperation({ summary: 'Get specific template' })
  async getTemplate(
    @Param('tenantId') tenantId: string,
    @Param('slug') slug: string,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    
    // Validate tenant access
    if (adminUser.role !== UserRole.SUPER_ADMIN && adminUser.tenant !== tenantId) {
      return {
        success: false,
        message: 'Cannot view template for another tenant',
      };
    }

    return this.templateService.findOne(tenantId, slug);
  }

  @Patch(':tenantId/:slug')
  @ApiOperation({ summary: 'Update template' })
  async updateTemplate(
    @Param('tenantId') tenantId: string,
    @Param('slug') slug: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    
    // Validate tenant access
    if (adminUser.role !== UserRole.SUPER_ADMIN && adminUser.tenant !== tenantId) {
      return {
        success: false,
        message: 'Cannot update template for another tenant',
      };
    }

    return this.templateService.update(tenantId, slug, updateTemplateDto);
  }

  @Delete(':tenantId/:slug')
  @ApiOperation({ summary: 'Delete template' })
  async deleteTemplate(
    @Param('tenantId') tenantId: string,
    @Param('slug') slug: string,
    @Req() request: Request,
  ) {
    const adminUser = request['adminUser'];
    
    // Validate tenant access
    if (adminUser.role !== UserRole.SUPER_ADMIN && adminUser.tenant !== tenantId) {
      return {
        success: false,
        message: 'Cannot delete template for another tenant',
      };
    }

    await this.templateService.delete(tenantId, slug);
    return { success: true, message: 'Template deleted successfully' };
  }
}
