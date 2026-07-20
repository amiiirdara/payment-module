import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
  IOrderEvent,
  OrderEventTypeEnum,
  OrderStateEnum,
  ParcelShippingCourier,
  ParcelStateEnum,
} from 'types/interfaces/order/order.interface';
import { UserModel } from '../../users/models/user.model';
import { OrderModel } from './order.model';
import { Relation } from 'typeorm';
import { ParcelModel } from './parcel.model';

@ObjectType()
export class OrderEventModel implements IOrderEvent {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  userId: number;

  @Field(() => Int)
  orderId: number;

  @Field(() => Int)
  parcelId: number;

  @Field(() => String)
  type: OrderEventTypeEnum;

  @Field(() => String, { nullable: true })
  state: OrderStateEnum;

  @Field(() => String, { nullable: true })
  parcelState: ParcelStateEnum;

  @Field(() => String, { nullable: true })
  shippingCourier: ParcelShippingCourier;

  @Field(() => UserModel)
  user: UserModel;

  @Field(() => OrderModel)
  order: Relation<OrderModel>;

  @Field(() => ParcelModel)
  parcel: Relation<ParcelModel>;

  @Field(() => String, { nullable: true })
  description: string;

  @Field(() => String, { nullable: true })
  durationInState?: string;

  @Field(() => Date)
  createdDate: Date;

  @Field(() => Date)
  updatedDate: Date;
}

@ObjectType()
export class ShippingStatus {
  @Field(() => [OrderEventModel])
  orderEvents: OrderEventModel[];

  @Field(() => ParcelModel)
  parcel: Relation<ParcelModel>;

  // @Field()
  // hasBeenShipped: boolean;
}
