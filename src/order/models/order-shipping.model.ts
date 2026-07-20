import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CarPartSize } from 'types/interfaces';
import {
  ParcelShippingCourier,
  ShippingDurationEnum,
  ShippingType,
} from 'types/interfaces/order/order.interface';

/** GraphQL view of OrderShippingEntity (the order_shipping_entity columns). */
@ObjectType()
export class OrderShippingModel {
  @Field(() => Int)
  id: number;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => Int, { nullable: true })
  cityId?: number;

  @Field(() => Int, { nullable: true })
  provinceId?: number;

  @Field(() => ShippingType)
  shippingType: ShippingType;

  @Field(() => Int)
  price: number;

  @Field(() => Int)
  packingCost: number;

  @Field(() => CarPartSize, { nullable: true })
  size?: CarPartSize;

  @Field(() => ShippingDurationEnum)
  shippingDuration: ShippingDurationEnum;

  @Field(() => ParcelShippingCourier, { nullable: true })
  courier?: ParcelShippingCourier;

  @Field(() => Int, { nullable: true })
  supplierUserId?: number;

  @Field(() => Date)
  createDate: Date;

  @Field(() => Date)
  updateDate: Date;
}
