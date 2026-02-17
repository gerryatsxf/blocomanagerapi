import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { ProductModule } from 'src/product/product.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CartSchema } from './entities/cart.schema';
import { CartLineItemSchema } from './entities/cart-line-item.schema';

@Module({
  controllers: [CartController],
  providers: [CartService],
  imports: [
    ProductModule,
    MongooseModule.forFeature([{ name: 'Cart', schema: CartSchema }]),
    MongooseModule.forFeature([
      { name: 'CartLineItem', schema: CartLineItemSchema },
    ]),
  ],
})
export class CartModule {}
