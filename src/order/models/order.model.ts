import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { IOrder } from 'types/interfaces/order/order.interface';
import { UserModel } from '../../users/models/user.model';
import { PaymentModel } from '../../payments/models/payment.model';
import { DiscountModel } from '../../discount/models/discount.model';
import { AddressCloneModel } from '../../address/models/address.model';
import { OrderEventModel } from './order-event.model';
import { OrderItemModel } from './order-item.model';
import { Paginated } from '../../common/gql/pagination.helper';
import { Relation } from 'typeorm';
import { FieldRole } from '../../access-control/access-control.middleware';
import { RoleType } from '../../auth/roles.enum';
import { SupplierModel } from 'src/supplier/models/supplier.model';
import { PaymentType } from 'types/interfaces/payment/payment.interface';
import { DomainNameEn } from 'types/enums/domain-name.enum';
import { OrderCancelDescriptionModel } from './order-cancel-description.model';
import { ParcelModel } from './parcel.model';
import { ReturnModel } from 'src/return/models/return.model';

@ObjectType()
export class OrderModel implements IOrder {
  @Field(() => Int)
  @FieldRole(RoleType.seller)
  id: number;

  @Field(() => Int)
  userId: number;

  @Field(() => Int, { nullable: true })
  paymentId: number;

  @Field(() => Int, { nullable: true })
  discountId: number;

  @Field(() => String, { nullable: true })
  postOfficeBarcode: string;

  @Field(() => String, { nullable: true })
  utm: string;

  @Field(() => Int, { nullable: true })
  addressCloneId: number;

  @Field(() => PaymentType, { nullable: true })
  paymentType: PaymentType;

  @Field(() => DomainNameEn, { nullable: true })
  domainNameEn: DomainNameEn;

  @Field(() => Float, { nullable: true })
  @FieldRole(RoleType.seller)
  totalPrice: number;

  @Field(() => Boolean)
  redirectToOrg: boolean;

  @Field(() => Date)
  @FieldRole(RoleType.seller)
  createdDate: Date;

  @Field(() => Date)
  @FieldRole(RoleType.seller)
  updatedDate: Date;

  @Field(() => UserModel)
  user: UserModel;

  @Field(() => AddressCloneModel, { nullable: true })
  addressClone: AddressCloneModel;

  @Field(() => OrderCancelDescriptionModel, { nullable: true })
  cancellation?: OrderCancelDescriptionModel;

  @Field(() => PaymentModel, { nullable: true })
  payment: Relation<PaymentModel>;

  @Field(() => [OrderEventModel], { nullable: true })
  events: Relation<OrderEventModel>[];

  @Field(() => [OrderItemModel])
  @FieldRole(RoleType.seller)
  items: Relation<OrderItemModel>[];

  @Field(() => [ParcelModel])
  @FieldRole(RoleType.seller)
  parcels: Relation<ParcelModel>[];

  @Field(() => [ReturnModel], { nullable: true })
  @FieldRole(RoleType.seller)
  returns: Relation<ReturnModel>[];

  @Field(() => DiscountModel, { nullable: true })
  discount: Relation<DiscountModel>;

  @Field(() => Float, { nullable: true })
  discountAmount: number;
}

export const PaginatedOrder = Paginated(OrderModel);
export type PaginatedOrder = InstanceType<typeof PaginatedOrder>;

@ObjectType()
export class SupplierItemListPrintOrder {
  @Field(() => SupplierModel)
  supplier: Relation<SupplierModel>;

  @Field(() => [OrderItemModel])
  items: Relation<OrderItemModel>[];
}

@ObjectType()
export class singleSupplierBijak {
  @Field(() => String)
  address: string;

  @Field(() => String)
  receiverNumber: string;

  @Field(() => String)
  receiverName: string;

  @Field(() => Int)
  id: number;

  @Field(() => [OrderItemModel])
  orderItems: Relation<OrderItemModel>[];
}

@ObjectType()
export class BijakPurchaseList {
  @Field(() => Int)
  numberOfItems: number;

  @Field(() => Int)
  totalQuantity: number;

  @Field(() => Int)
  id: number;

  @Field(() => OrderItemModel)
  orderItem: Relation<OrderItemModel>;

  @Field(() => SupplierModel)
  supplier: Relation<SupplierModel>;
}

@ObjectType()
export class PaginatedOrderWithDelayedItems extends PaginatedOrder {
  @Field(() => Int)
  @FieldRole(RoleType.seller)
  delayedItems: number;
}
