import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { IOrderItem } from 'types/interfaces/order/order.interface';
import { UserModel } from '../../users/models/user.model';
import { OrderModel } from './order.model';
import { CarPartConfigModel } from '../../car-part/models/car-part-config.model';
import { Relation } from 'typeorm';
import { FieldRole } from '../../access-control/access-control.middleware';
import { RoleType } from '../../auth/roles.enum';
import { PhysicalOrderItemModel } from 'src/physical-item/models/physical-order-item.model';
import { ParcelModel } from './parcel.model';

@ObjectType()
export class OrderItemModel implements IOrderItem {
  @Field(() => Int)
  @FieldRole(RoleType.seller)
  id: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  orderId: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  configId: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  quantity: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  checkoutPrice: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  checkoutBasePrice: number;

  @Field(() => Float)
  checkoutPurchasePrice: number;

  @Field(() => Int, { nullable: true })
  feeAmount: number;

  @Field(() => Boolean)
  isChangeUpdatePrice: boolean;

  @Field(() => Int, { nullable: true })
  tempParcelId: number | null;

  @Field(() => UserModel)
  user: Relation<UserModel>;

  @Field(() => OrderModel)
  order: Relation<OrderModel>;

  @Field(() => CarPartConfigModel)
  @FieldRole(RoleType.seller)
  config: Relation<CarPartConfigModel>;

  @Field(() => [PhysicalOrderItemModel], { nullable: true })
  @FieldRole(RoleType.seller)
  physicalOrderItems: Relation<PhysicalOrderItemModel>[];

  @Field(() => ParcelModel, { nullable: true })
  tempParcel: Relation<ParcelModel> | null;

  @Field(() => Boolean)
  @FieldRole(RoleType.seller)
  isMarketplace: boolean;

  @Field(() => Date)
  @FieldRole(RoleType.seller)
  createdDate: Date;

  @Field(() => Date)
  @FieldRole(RoleType.seller)
  updatedDate: Date;
}
