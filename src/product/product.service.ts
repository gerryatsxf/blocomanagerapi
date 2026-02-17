import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './entities/product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async create(createProductDto: CreateProductDto, tenant: string = 'blocomanager'): Promise<Product> {
    const createdProduct = new this.productModel({
      ...createProductDto,
      currency: 'MXN',
      tenant: createProductDto.tenant || tenant,
    });
    return createdProduct.save();
  }

  async findAll(): Promise<Product[]> {
    return this.productModel.find({ active: true }).exec();
  }

  async findAllForAdmin(): Promise<Product[]> {
    return this.productModel.find().exec();
  }

  async findByTenant(tenant: string): Promise<Product[]> {
    return this.productModel.find({ tenant }).exec();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, updateProductDto, { new: true })
      .exec();
    if (!updatedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return updatedProduct;
  }

  async toggleActive(id: string): Promise<Product> {
    const product = await this.findOne(id);
    product.active = !product.active;
    return this.productModel
      .findByIdAndUpdate(id, { active: product.active }, { new: true })
      .exec();
  }

  async hardDelete(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }
}
