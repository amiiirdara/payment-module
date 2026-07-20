import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ICartItem } from 'types/interfaces/cart/cart.interface';
import { CartModel } from './cart.model';
import { Relation } from 'typeorm';
import { CarPartConfigModel } from '../../car-part/models/car-part-config.model';

@ObjectType()
export class CartItemModel implements ICartItem {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  cartId: number;

  @Field(() => Int)
  configId: number;

  @Field(() => Int)
  quantity: number;

  @Field(() => Boolean)
  isMarketplace: boolean;

  @Field(() => Date)
  createdDate: Date;

  @Field(() => Date)
  updatedDate: Date;

  @Field(() => CartModel)
  cart: Relation<CartModel>;

  @Field(() => CarPartConfigModel)
  config: Relation<CarPartConfigModel>;
}
