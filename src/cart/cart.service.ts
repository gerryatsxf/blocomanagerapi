import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AddToCartRequestDto } from './dto/add-to-cart-request.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICart } from './entities/cart.interface';
import { ISession } from 'src/session/entities/session.interface';
import { ICartLineItem } from './entities/cart-line-item.interface';
import { CreateCartLineItemRequestDto } from './dto/create-cart-line-request.dto';
import { ProductService } from 'src/product/product.service';

@Injectable()
export class CartService {
  constructor(
    @InjectModel('CartLineItem')
    private readonly cartLineItemModel: Model<ICartLineItem>,
    @InjectModel('Cart') private readonly cartModel: Model<ICart>,
    private readonly productService: ProductService,
  ) {}

  async createCartInstance(sessionInfo) {
    const newCart = {} as any;
    newCart.items = [];
    newCart.sessionId = sessionInfo.id;
    newCart.itemCount = 0;
    newCart.total = 0;
    newCart.subtotal = newCart.total;
    newCart.creationTimestamp = new Date().getTime();
    const cart = new this.cartModel(newCart);
    await cart.save();
    return cart;
  }

  async removeCartLineItem(cartLineItemId, sessionInfo) {
    // then check if cart exists, and create it if it doesnt
    let cart: ICart | null = await this.getCartBySessionId(sessionInfo.id);
    if (!cart) {
      throw BadRequestException;
    } else if (cart && cart.items.length == 0) {
      throw UnprocessableEntityException;
    } else {
      cart.items = cart.items.filter(
        (cartLineItem) => cartLineItem.id != cartLineItemId,
      );
      await cart.save();
      return cart;
    }
  }

  async removeProductItemsFromCart(productId, quantity, sessionInfo) {
    // then check if cart exists, and create it if it doesnt
    let cart: ICart | null = await this.getCartBySessionId(sessionInfo.id);
    if (!cart) {
      throw BadRequestException;
    } else if (cart && cart.items.length == 0) {
      throw UnprocessableEntityException;
    } else {
      const cartLinesFound = await cart.items.filter(
        (cartLineItem) => cartLineItem.productId == productId,
      );
      if (cartLinesFound.length == 0) {
        throw UnprocessableEntityException;
      } else if (cartLinesFound.length == 1) {
        const cartLineItem = cartLinesFound[0];
        const product = await this.productService.findOne(productId);
        const price = product.price;

        const newQuantity = cartLineItem.quantity - quantity;
        if (newQuantity <= 0) {
          await this.removeCartLineItem(cartLineItem.id, sessionInfo);
        } else {
          await this.cartLineItemModel.findByIdAndUpdate(cartLineItem.id, {
            quantity: newQuantity,
          });
          cart.itemCount += newQuantity;
          cart.total += price * newQuantity;
          cart.subtotal = cart.total;
          await cart.save();
        }
      }

      return (await this.cartModel.findById(cart.id)).populate('items');
    }
  }

  async createCartLineItemInstance(product, quantity) {
    const payload = {} as any;
    payload.productId = product._id || product.id;
    payload.productTypeId = 'sdfsfd';
    payload.label = product.name;
    payload.alias = 'an alias';
    payload.description = product.description;
    payload.unitPrice = product.price;
    payload.quantity = quantity;
    payload.thumbnailImageSrc = 'hehe';
    payload.timestampAdded = new Date().getTime();
    payload.permalink = 'jojo';
    return this.cartLineItemModel.create(payload);
  }

  async addProduct(request: AddToCartRequestDto, sessionInfo: ISession) {
    // fetch product
    const product = await this.productService.findOne(request.productId);
    const price = product.price;

    // then check if cart exists, and create it if it doesnt
    let cart: ICart | null = await this.getCartBySessionId(sessionInfo.id);
    if (!cart) {
      cart = await this.createCartInstance(sessionInfo);
    }

    // Handle empty cart
    if (cart.itemCount == 0) {
      const cartLineItem = await this.createCartLineItemInstance(
        product,
        request.quantity,
      );
      cart.items.push(cartLineItem.id);
      cart.itemCount = request.quantity;
      cart.total = price * request.quantity;
      cart.subtotal = cart.total;
      await cart.save();
    } else if (cart.itemCount > 0) {
      const cartLinesFound = await cart.items.filter(
        (cartLineItem) => cartLineItem.productId == request.productId,
      );
      if (cartLinesFound.length == 0) {
        const cartLineItem = await this.createCartLineItemInstance(
          product,
          request.quantity,
        );
        cart.items.push(cartLineItem.id);
        cart.itemCount = request.quantity;
        cart.total = price * request.quantity;
        cart.subtotal = cart.total;
        await cart.save();
      } else if (cartLinesFound.length == 1) {
        await this.cartLineItemModel.findByIdAndUpdate(cart.items[0].id, {
          quantity: cart.items[0].quantity + request.quantity,
        });
        cart.itemCount += request.quantity;
        cart.total += price * request.quantity;
        cart.subtotal = cart.total;
        await cart.save();
      }
    }

    return (await this.cartModel.findById(cart.id)).populate('items');
  }

  async addCartLineItem(cartLineItem, cartId) {
    const payload = {};
  }

  async getCartBySessionId(sessionId: string): Promise<ICart | null> {
    return this.cartModel.findOne({ sessionId }).populate('items');
  }

  findAll() {
    return `This action returns all cart`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cart`;
  }

  // update(id: number, updateCartDto: UpdateCartDto) {
  //   return `This action updates a #${id} cart`;
  // }

  remove(id: number) {
    return `This action removes a #${id} cart`;
  }
}
