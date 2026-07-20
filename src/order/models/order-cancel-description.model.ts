import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Relation } from 'typeorm';
import {
  IOrderCancelDescription,
  OrderCancelReason,
} from 'types/interfaces/order/order.interface';
import { OrderModel } from './order.model';

@ObjectType()
export class OrderCancelDescriptionModel implements IOrderCancelDescription {
  @Field(() => Int)
  orderId: number;

  @Field(() => OrderCancelReason)
  cancelReason: OrderCancelReason;

  @Field({ nullable: true })
  cancelDescription?: string;

  @Field(() => OrderModel)
  order: Relation<OrderModel>;

  @Field()
  createdDate: Date;

  @Field()
  updatedDate: Date;
}
