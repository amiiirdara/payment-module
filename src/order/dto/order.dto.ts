import { ArgsType, Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsDefined,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  FilterableEnum,
  IFilterable,
} from 'src/common/gql/filter-helper/filter-enum.helper';
import { Filter } from 'src/common/gql/filter-helper/filter.decorator';
import { Query } from 'src/common/gql/query-helper';
import {
  ItemCancelReasonEnum,
  OrderStateTimeFilterEnum,
  ParcelShippingCourier,
  ParcelShippingListCityEnum,
  ParcelStateEnum,
  PickupInStoreFilterStateEnum,
  ShippingType,
} from 'types/interfaces/order/order.interface';
import { OrderModel } from '../models/order.model';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentType } from 'types/interfaces/payment/payment.interface';
import { PaginationArgs } from 'src/common/gql/pagination.helper';
import {
  SellerParcelsGetOrderBy,
  SupplyStateEnum,
} from 'types/interfaces/supply/supply.interface';
import { CreateShoppingCartDto } from './cart.dto';
import { ParcelModel } from '../models/parcel.model';
import { PhysicalOrderItemModel } from 'src/physical-item/models/physical-order-item.model';

export class CreateOrderDto {
  // OI-4: optional because an install-only order (no goods, only installation
  // bookings) needs no delivery address — installation happens at the
  // technician's location. Still required for a cart with goods, enforced in
  // proceedCheckout (validateAndGetAddress throws 'invalid-address' when a goods
  // cart has no/invalid addressId).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  addressId?: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  discountCode: string;

  @ApiProperty({
    enum: PaymentType,
  })
  @IsDefined()
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiProperty()
  @IsDefined()
  @IsNumber()
  totalPrice: number;

  // OI-4: optional — an install-only order has no parcels (parcels are built
  // from goods). Required for a cart with goods, enforced in proceedCheckout
  // (validateParcel rejects a goods cart whose parcels don't match).
  @ApiProperty({
    required: false,
    type: () => ParcelShippingDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParcelShippingDto)
  parcels?: ParcelShippingDto[];

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  isOrg: boolean;

  @ApiProperty()
  @IsOptional()
  @IsString()
  tatoken?: string;
}

export class ParcelShippingDto {
  @ApiProperty()
  @IsDefined()
  @IsNumber()
  row: number;

  @ApiProperty()
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateShoppingCartDto)
  @IsArray()
  items: CreateShoppingCartDto[];

  // Must declare `enum` explicitly: under SWC there is no type-checker, so the
  // plugin reflects `design:type` as the ShippingType *object*. A bare
  // @ApiProperty() then treats that enum object as a nested model and recurses
  // its members, crashing with a bogus "circular dependency (property key:
  // STANDARD)" at schema-build time. `enum:` tells Swagger it's an enum.
  @ApiProperty({ enum: ShippingType })
  @IsDefined()
  @IsEnum(ShippingType)
  shippingType: ShippingType;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  inStoreSupplierUserId?: number;

  @ApiProperty()
  @IsDefined()
  @IsDateString()
  processDate: Date;
}

export class AvailableShippigTypeDtoEwano {
  @ApiProperty()
  @IsDefined()
  @IsNumber()
  @Type(() => Number)
  cityId: number;

  @ApiProperty()
  @IsDefined()
  @IsNumber()
  @Type(() => Number)
  provinceId: number;
}

export class AvailableShippigTypeDto {
  @ApiProperty()
  @IsDefined()
  @IsNumber()
  @Type(() => Number)
  cityId: number;

  @ApiProperty()
  @IsDefined()
  @IsNumber()
  @Type(() => Number)
  provinceId: number;
}

@InputType()
export class OrderFilter {
  @Filter(Int)
  id?: IFilterable<number>;

  @Filter(Date)
  createdDate: IFilterable<Date>;
}
@InputType()
export class ParcelFilter {
  @Filter(Int)
  id?: IFilterable<number>;

  @Filter(FilterableEnum(ParcelStateEnum, 'ParcelState'))
  state: IFilterable<ParcelStateEnum>;

  @Filter(Date)
  createdDate: IFilterable<Date>;
}

export class CancellOrderDto {
  @IsDefined()
  @IsNumber()
  id: number;
}

export class SnappPayEligibleDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  amount: string;
}

@InputType()
export class SnappPayCartItemDto {
  @IsNumber()
  @Field(() => Int)
  id: number;

  @IsNumber()
  @Field(() => Int)
  amount: number;

  @IsString()
  @Field()
  category: string;

  @IsOptional()
  @IsNumber()
  @Field(() => Int, { nullable: true })
  commissionType?: number;

  @IsNumber()
  @Field(() => Int)
  count: number;

  @IsString()
  @Field()
  name: string;
}

@InputType()
export class SnappPayCartDto {
  @IsNumber()
  @Field(() => Int)
  cartId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SnappPayCartItemDto)
  @Field(() => [SnappPayCartItemDto])
  cartItems: SnappPayCartItemDto[];

  @IsNumber()
  @Field(() => Int)
  totalAmount: number;

  @IsNumber()
  @Field(() => Int)
  shippingAmount: number;

  @IsNumber()
  @Field(() => Int)
  taxAmount: number;

  @IsBoolean()
  @Field(() => Boolean)
  isShipmentIncluded: boolean;

  @IsBoolean()
  @Field(() => Boolean)
  isTaxIncluded: boolean;
}

@InputType()
export class SnappPayUpdateDto {
  @IsNumber()
  @Field(() => Int)
  amount: number;

  @IsString()
  @Field()
  paymentToken: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SnappPayCartDto)
  @Field(() => [SnappPayCartDto])
  cartList: SnappPayCartDto[];

  @IsNumber()
  @Field(() => Int)
  discountAmount: number;
}
@InputType()
export class TaraInvoiceItemDto {
  @Field()
  name: string;

  @Field()
  code: number; //carPartConfigId

  @Field()
  count: number;

  @Field()
  unit: number;

  @Field()
  fee: number;
}
@InputType()
export class TaraPartialRefundDto {
  @IsNumber()
  @Field(() => Int)
  amount: number; //amount to refund

  @IsString()
  @Field()
  referenceNumber: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TaraInvoiceItemDto)
  @Field(() => [TaraInvoiceItemDto])
  orderItem?: TaraInvoiceItemDto[];
}

@InputType()
export class ParcelIdInput {
  @Field(() => Int)
  @IsInt()
  parcelId: number;
}
@InputType()
export class ParcelShippingInput {
  @Field(() => Int)
  @IsInt()
  parcelId: number;

  @Field(() => String)
  @IsString()
  description: string;

  @IsEnum(ParcelShippingCourier)
  @IsDefined()
  @Field(() => ParcelShippingCourier)
  courier: ParcelShippingCourier;

  // @Field(() => Boolean)
  // @IsBoolean()
  // isDuplicate: boolean;
}
@InputType()
export class CancelOrderInput {
  @Field()
  @IsInt()
  orderId: number;

  @Field(() => ItemCancelReasonEnum)
  @IsEnum(ItemCancelReasonEnum)
  reason: ItemCancelReasonEnum;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
@InputType()
export class transactionIdInput {
  @Field()
  @IsString()
  transactionId: string;
}

@InputType()
export class AdminCancelOrderCallDigiPayInput {
  @Field(() => Int)
  @IsInt()
  orderId: number;

  @Field(() => Int, { description: 'مبلغ برگشتی به ریال' })
  @IsInt()
  amount: number;
}

@InputType()
export class parcelInput {
  @Field(() => Int)
  @IsInt()
  parcelId: number;
}

export const OrderQuery = Query(OrderModel, OrderFilter);
export type OrderQuery = InstanceType<typeof OrderQuery>;

export const ParcelQuery = Query(ParcelModel, ParcelFilter);
export type ParcelQuery = InstanceType<typeof ParcelQuery>;

@InputType()
export class ShippingListInput {
  @Field(() => ParcelShippingListCityEnum, {
    nullable: true,
    defaultValue: ParcelShippingListCityEnum.ALL,
  })
  @IsEnum(ParcelShippingListCityEnum)
  @IsOptional()
  city: ParcelShippingListCityEnum = ParcelShippingListCityEnum.ALL;

  @IsOptional()
  @Field(() => PaginationArgs, { nullable: true })
  pagination: PaginationArgs;
}
@InputType()
export class GetSellerOrders {
  @IsOptional()
  @IsEnum(SupplyStateEnum)
  @Field(() => SupplyStateEnum, {
    nullable: true,
    defaultValue: null,
  })
  supplyState: SupplyStateEnum;

  @IsOptional()
  @IsEnum(ParcelStateEnum, { each: true })
  @Field(() => [ParcelStateEnum], {
    nullable: true,
    defaultValue: null,
  })
  parcelStates: ParcelStateEnum[];

  @IsDefined()
  @IsEnum(SellerParcelsGetOrderBy)
  @Field(() => SellerParcelsGetOrderBy)
  OrderBy: SellerParcelsGetOrderBy;

  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean)
  isDisplayingWithoutBillOfLading: boolean;

  @IsDefined()
  @IsBoolean()
  @Field(() => Boolean)
  shipBySeller: boolean;

  @IsOptional()
  @IsEnum(OrderStateTimeFilterEnum)
  @Field(() => OrderStateTimeFilterEnum, {
    nullable: true,
    defaultValue: null,
  })
  stateTime: OrderStateTimeFilterEnum;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Field(() => Date, { nullable: true, defaultValue: null })
  dueDate: Date;

  @Field(() => Int, { defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  page = 0;

  @Field(() => Int, { defaultValue: 10 })
  @IsOptional()
  @IsNumber()
  limit = 10;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  fullTextSearch: string;
}

@ObjectType()
export class PhysicalOrderItemsByParcelDto {
  @Field(() => ParcelModel)
  parcel: ParcelModel;

  @Field(() => [PhysicalOrderItemModel])
  physicalOrderItems: PhysicalOrderItemModel[];
}

@InputType()
export class PickupInStoreFilterInput {
  @IsOptional()
  @IsEnum(PickupInStoreFilterStateEnum)
  @Field(() => PickupInStoreFilterStateEnum, { nullable: true })
  state?: PickupInStoreFilterStateEnum;
}

@ArgsType()
export class GetPickupInStoreParcelsInput {
  @ValidateNested()
  @Type(() => PickupInStoreFilterInput)
  @Field(() => PickupInStoreFilterInput)
  filter: PickupInStoreFilterInput;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  fullTextSearch: string | null;

  @IsOptional()
  @Field(() => PaginationArgs, { nullable: true })
  pagination: PaginationArgs;
}

@InputType()
export class ParcelChangeStateInput {
  @Field(() => Int)
  @IsInt()
  parcelId: number;

  @Field(() => ParcelStateEnum)
  @IsEnum(ParcelStateEnum)
  state: ParcelStateEnum;
}
