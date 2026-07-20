import { Field, Int, ObjectType, Float } from '@nestjs/graphql';
import {
  FreeShippingReason,
  IParcel,
  ParcelDeliveryMethod,
  ParcelShippingCourier,
  ParcelStateEnum,
  ShippingDurationEnum,
  ShippingType,
} from 'types/interfaces/order/order.interface';
import { OrderModel } from './order.model';
import { Relation } from 'typeorm';
import { PhysicalOrderItemModel } from 'src/physical-item/models/physical-order-item.model';
import { Paginated } from 'src/common/gql/pagination.helper';
import { OrderItemModel } from './order-item.model';
import { OrderEventModel } from './order-event.model';
import { FieldRole } from 'src/access-control/access-control.middleware';
import { RoleType } from 'src/auth/roles.enum';
import { SupplierModel } from 'src/supplier/models/supplier.model';
import { ShippingModel } from 'src/shipping/models/shipping.model';
import { CarPartSize } from 'types/interfaces';

@ObjectType()
export class ParcelModel implements IParcel {
  @Field(() => Int)
  id: number;

  @Field(() => ParcelStateEnum)
  state: ParcelStateEnum;

  @Field(() => String)
  shippingType: ShippingType;

  @Field(() => CarPartSize)
  size: CarPartSize;

  @Field(() => Float, { nullable: true })
  shippingCost: number;

  @Field(() => Float, { nullable: true })
  baseShippingCost: number;

  @Field(() => Float)
  packingCost: number;

  @Field(() => ShippingDurationEnum)
  shippingDuration: ShippingDurationEnum;

  @Field(() => FreeShippingReason)
  freeShippingReason: FreeShippingReason;

  @Field(() => ParcelDeliveryMethod)
  parcelDeliveryMethod: ParcelDeliveryMethod;

  @Field(() => Date, { nullable: true })
  supplierDeliveryDate?: Date;

  @Field(() => Date, { nullable: true })
  collectDeadline: Date;

  @Field(() => Date, { nullable: true })
  prepDeadline: Date;

  @Field(() => Boolean)
  isExpressShipping: boolean;

  @Field(() => Date, { nullable: true })
  deliveryDeadline: Date;

  @Field(() => Int, { nullable: true })
  shippingSupplierUserId: number | null;

  @Field(() => Boolean)
  isShippingCostRefunded: boolean;

  @Field(() => Int)
  orderId: number;

  @Field(() => ParcelShippingCourier, { nullable: true })
  courier: ParcelShippingCourier | null;

  @Field(() => OrderModel)
  order: Relation<OrderModel>;

  @Field(() => [PhysicalOrderItemModel])
  physicalOrderItems: Relation<PhysicalOrderItemModel>[];

  @Field(() => [OrderItemModel])
  tempItems: Relation<OrderItemModel>[];

  @Field(() => [OrderEventModel])
  events: Relation<OrderEventModel>[];

  @Field(() => ShippingModel, { nullable: true })
  @FieldRole(RoleType.seller)
  shipping: Relation<ShippingModel>[] | null;

  @Field(() => Date)
  createdDate: Date;

  @Field(() => Date)
  updatedDate: Date;

  @Field(() => Int, { nullable: true })
  inStoreSupplierUserId: number | null;

  @Field(() => SupplierModel, { nullable: true })
  inStoreSupplier: Relation<SupplierModel> | null;

  @Field(() => String, { nullable: true })
  deliveryAndShipping?: string;
}

export const PaginatedParcel = Paginated(ParcelModel);
export type PaginatedParcel = InstanceType<typeof PaginatedParcel>;

@ObjectType()
export class PaginatedShippingList extends PaginatedParcel {
  @Field(() => Int)
  tehranTotal: number;

  @Field(() => Int)
  otherTotal: number;

  @Field(() => Int)
  allTotal: number;
}

@ObjectType()
export class PaginatedParcelWithDelayedItems extends PaginatedParcel {
  @Field(() => Int)
  @FieldRole(RoleType.seller)
  delayedItems: number;
}
