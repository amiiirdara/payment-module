import {
  Args,
  Context,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { OrderModel, PaginatedOrder } from '../models/order.model';
import { OrderService } from '../order.service';
import { GQLAuth } from 'src/auth/auth.decorator';
import {
  CancelOrderInput,
  AdminCancelOrderCallDigiPayInput,
  transactionIdInput,
  OrderQuery,
  ParcelIdInput,
  parcelInput,
  ShippingListInput,
  SnappPayUpdateDto,
  TaraPartialRefundDto,
} from '../dto/order.dto';
import { UserModel } from '../../users/models/user.model';
import { UserLoader } from '../../users/loaders/users.loader';
import { OrderLoader } from '../loaders/order.loader';
import { OrderItemModel } from '../models/order-item.model';
import { CurrentUser } from '../../decorators/get-current-user.decorator';
import { JwtDto } from '../../auth/dto/jwt.dto';
import { RoleType } from '../../auth/roles.enum';
import { FieldRole } from '../../access-control/access-control.middleware';
import { AddressLoader } from 'src/address/loader/address.loader';
import { AddressCloneModel } from 'src/address/models/address.model';
import { PaymentModel } from 'src/payments/models/payment.model';
import { PaymentLoader } from 'src/payments/loader/payment.loader';
import { DiscountModel } from 'src/discount/models/discount.model';
import { DiscountLoader } from 'src/discount/loaders/discount.loader';
import { OrderEventModel, ShippingStatus } from '../models/order-event.model';
import { OrderCancelDescriptionModel } from '../models/order-cancel-description.model';

import { PaginatedShippingList, ParcelModel } from '../models/parcel.model';
import { Roles } from 'src/auth/guards/gql-auth.guard';
import { ReturnLoader } from 'src/return/loader/return.loader';
import { ReturnModel } from 'src/return/models/return.model';

@Resolver(() => OrderModel)
@GQLAuth()
export class OrderResolver {
  constructor(
    private service: OrderService,
    private userLoader: UserLoader,
    private orderLoader: OrderLoader,
    private addressLoader: AddressLoader,
    private paymentLoader: PaymentLoader,
    private discountLoader: DiscountLoader,
    private returnLoader: ReturnLoader,
  ) {}

  @ResolveField('user', () => UserModel, { nullable: true })
  async getUser(@Parent() order: OrderModel) {
    if (order.userId) return this.userLoader.getUserById.load(order.userId);
    return null;
  }

  @ResolveField('items', () => [OrderItemModel], { nullable: true })
  @FieldRole(RoleType.seller)
  async getCart(@Parent() order: OrderModel, @Context() context) {
    if (order.id)
      return this.orderLoader.getOrderItems.load({
        orderId: order.id,
        supplierUserId: context.supplierUserId || undefined,
      });
    return null;
  }

  @ResolveField('addressClone', () => AddressCloneModel, { nullable: true })
  async getAddressClone(@Parent() order: OrderModel) {
    if (order.addressCloneId)
      return this.addressLoader.addresses.load(order.addressCloneId);
    return null;
  }

  @ResolveField('payment', () => PaymentModel)
  async getPayment(@Parent() order: OrderModel) {
    if (order.paymentId)
      return this.paymentLoader.getPaymentById.load(order.paymentId);
    return null;
  }

  @ResolveField('discount', () => DiscountModel, { nullable: true })
  async getDiscount(@Parent() order: OrderModel) {
    if (order.discountId)
      return this.discountLoader.getDiscountById.load(order.discountId);
    return null;
  }

  @ResolveField('events', () => [OrderEventModel], { nullable: true })
  async events(@Parent() order: OrderModel) {
    if (order.id) {
      const result = await this.orderLoader.getEvensByOrderId.load(order.id);

      return result;
    }
    return null;
  }

  @ResolveField('cancellation', () => OrderCancelDescriptionModel, {
    nullable: true,
  })
  async getCancellation(@Parent() order: OrderModel) {
    if (order.id) return this.orderLoader.getOrderCancellation.load(order.id);
    return null;
  }

  @ResolveField('parcels', () => ParcelModel, { nullable: true })
  async parcels(@Parent() order: OrderModel) {
    if (order.parcels) {
      return order.parcels;
    }
    return this.orderLoader.getParcelsByOrderId.load(order.id);
  }

  @ResolveField('returns', () => [ReturnModel], {
    nullable: true,
  })
  async returns(@Parent() order: OrderModel) {
    if (order.returns) {
      return order.returns;
    }
    return this.returnLoader.getReturnsByOrderId.load(order.id);
  }

  @Query(() => PaginatedOrder)
  async adminOrdersGet(@Args({ type: () => OrderQuery }) query: OrderQuery) {
    return this.service.getOrders(query);
  }

  @Query(() => OrderModel)
  async adminOrderGet(@Args('orderId', { type: () => Int }) orderId: number) {
    return this.service.getOrderById(orderId);
  }

  @Query(() => PaginatedShippingList)
  async getReadyToShipParcels(
    @Args('query', { type: () => ShippingListInput }) query: ShippingListInput,
  ) {
    return this.service.getReadyToShipParcels(query);
  }

  // @Query(() => OrderStatsModel)
  // @Roles([RoleType.seller])
  // async sellerOrdersStatsGet(
  //   @Args('timeRange', { type: () => OrderStatisticsRangeDto, nullable: true })
  //   timeRange: OrderStatisticsRangeDto,
  //   @CurrentUser() user: JwtDto,
  // ) {
  //   const finalTimeRange = timeRange?.range
  //     ? timeRange?.range
  //     : OrderStatisticsTimeRanges.ALL;
  //   return this.service.getOrderStats(user.id, finalTimeRange);
  // }

  @Mutation(() => Boolean)
  async updateSnappay(@Args('data') input: SnappPayUpdateDto) {
    return this.service.updateSnappay(input);
  }

  @Mutation(() => Boolean)
  async updateTorobpay(@Args('data') input: SnappPayUpdateDto) {
    return this.service.updateTorobpay(input);
  }

  @Mutation(() => Boolean)
  async partialRefundTara(@Args('data') input: TaraPartialRefundDto) {
    return this.service.partialRefundTara(input);
  }

  @Mutation(() => Boolean)
  async adminWatingForPacking(
    @Args('data') input: parcelInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.service.adminWatingForPacking(input, user.id);
  }

  @Mutation(() => Boolean)
  async adminWatingForShipment(
    @Args('data') input: parcelInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.service.adminWatingForShipment(input, user.id);
  }

  @Query(() => ShippingStatus)
  async adminParcelGetShippingStatus(@Args('data') input: ParcelIdInput) {
    return this.service.adminParcelGetShippingStatus(input.parcelId);
  }

  @Mutation(() => Boolean)
  async adminShippingDelivered(
    @Args('data') input: parcelInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.service.adminShippingDelivered(input, user.id);
  }

  @Mutation(() => Boolean)
  @Roles([RoleType.seller])
  async sellerShippingDelivered(
    @Args('data') input: parcelInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.service.sellerShippingDelivered(input, user.id);
  }

  @Mutation(() => Boolean)
  @Roles([RoleType.seller])
  async sellerConfirmProccessing(
    @Args('data') input: parcelInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.service.sellerConfirmProccessing(input, user.id);
  }

  @Mutation(() => Boolean)
  async adminCancelOrder(
    @Args('data') input: CancelOrderInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.service.adminCancelOrder(input, user);
  }

  @Mutation(() => Boolean)
  async adminCancelOrderByPass(
    @Args('data') input: CancelOrderInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.service.adminCancelOrder(input, user, false);
  }

  @Mutation(() => Boolean)
  async adminCancelOrderCallSnapp(
    @Args('data') input: transactionIdInput,
  ): Promise<boolean> {
    return this.service.adminCancelOrderCallSnapp(input);
  }

  @Mutation(() => Boolean)
  async adminCancelOrderCallTorob(
    @Args('data') input: transactionIdInput,
  ): Promise<boolean> {
    return this.service.adminCancelOrderCallTorob(input);
  }

  @Mutation(() => Boolean)
  async adminCancelOrderCallDigiPay(
    @Args('data') input: AdminCancelOrderCallDigiPayInput,
  ): Promise<boolean> {
    return this.service.adminCancelOrderCallDigiPay(input);
  }
}
