import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Template, TemplateDocument } from './entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplateService {
  constructor(
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
  ) {}

  async create(createTemplateDto: CreateTemplateDto): Promise<Template> {
    // Use upsert to create or update existing template
    const template = await this.templateModel
      .findOneAndUpdate(
        { 
          templateTenant: createTemplateDto.templateTenant,
          templateSlug: createTemplateDto.templateSlug 
        },
        { $set: createTemplateDto },
        { new: true, upsert: true },
      )
      .exec();
    
    return template;
  }

  async findByTenant(tenant: string): Promise<Template[]> {
    return this.templateModel.find({ templateTenant: tenant }).exec();
  }

  async findOne(tenant: string, slug: string): Promise<Template> {
    const template = await this.templateModel
      .findOne({ templateTenant: tenant, templateSlug: slug })
      .exec();
    
    if (!template) {
      throw new NotFoundException(
        `Template "${slug}" not found for tenant "${tenant}"`
      );
    }
    
    return template;
  }

  async update(
    tenant: string,
    slug: string,
    updateTemplateDto: UpdateTemplateDto,
  ): Promise<Template> {
    const template = await this.templateModel
      .findOneAndUpdate(
        { templateTenant: tenant, templateSlug: slug },
        { $set: updateTemplateDto },
        { new: true },
      )
      .exec();

    if (!template) {
      throw new NotFoundException(
        `Template "${slug}" not found for tenant "${tenant}"`
      );
    }

    return template;
  }

  async delete(tenant: string, slug: string): Promise<void> {
    const result = await this.templateModel
      .deleteOne({ templateTenant: tenant, templateSlug: slug })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Template "${slug}" not found for tenant "${tenant}"`
      );
    }
  }
}
