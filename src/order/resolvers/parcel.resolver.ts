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
import { GQLAuth } from 'src/auth/auth.decorator';
import {
  PaginatedParcel,
  PaginatedParcelWithDelayedItems,
  ParcelModel,
} from '../models/parcel.model';
import { OrderModel } from '../models/order.model';
import { OrderService } from '../order.service';
import { OrderLoader } from '../loaders/order.loader';
import { PhysicalOrderItemModel } from 'src/physical-item/models/physical-order-item.model';
import { OrderEventModel } from '../models/order-event.model';
import {
  GetSellerOrders,
  GetPickupInStoreParcelsInput,
  ParcelChangeStateInput,
  ParcelQuery,
} from '../dto/order.dto';
import { RoleType } from 'src/auth/roles.enum';
import { Roles } from 'src/auth/guards/gql-auth.guard';
import { JwtDto } from 'src/auth/dto/jwt.dto';
import { CurrentUser } from 'src/decorators/get-current-user.decorator';
import { ParcelService } from '../services/parcel.service';
import {
  CancelParcelInput,
  CancelPickUpInstoreParcelInput,
} from 'src/physical-item/dto/physical-item.dto';
import { ParcelLoader } from '../loaders/parcel.loader';
import { ShippingLoader } from 'src/shipping/shipping.loader';
import { ShippingModel } from 'src/shipping/models/shipping.model';
import { FieldRole } from 'src/access-control/access-control.middleware';

@Resolver(() => ParcelModel)
@GQLAuth()
export class ParcelResolver {
  constructor(
    private orderLoader: OrderLoader,
    private readonly orderService: OrderService,
    private readonly parcelService: ParcelService,
    private readonly parcelLoader: ParcelLoader,
    private readonly shippingLoader: ShippingLoader,
  ) {}

  @ResolveField('deliveryAndShipping', () => String)
  async getDeliveryAndShipping(@Parent() parcel: ParcelModel) {
    return this.orderService.getDeliveryAndShipping(parcel);
  }

  @ResolveField(() => OrderModel, { nullable: true })
  async order(@Parent() parcel: ParcelModel) {
    if (!parcel.orderId) {
      return null;
    }
    if (parcel.order) {
      return parcel.order;
    }
    return this.orderLoader.getOrderById.load(parcel.orderId);
  }

  @ResolveField('events', () => [OrderEventModel], { nullable: true })
  async events(@Parent() parcel: ParcelModel) {
    if (parcel.id) {
      const result = await this.orderLoader.getEvensByParcelId.load(parcel.id);

      return result;
    }
    return null;
  }

  @ResolveField('physicalOrderItems', () => [PhysicalOrderItemModel], {
    nullable: true,
  })
  async physicalOrderItems(@Parent() parcel: ParcelModel) {
    if (parcel.physicalOrderItems) {
      return parcel.physicalOrderItems;
    }
    return this.orderLoader.getPhysicalOrderItemsByParcelId.load(parcel.id);
  }

  @ResolveField('tempItems', () => [PhysicalOrderItemModel], {
    nullable: true,
  })
  async tempItems(@Parent() parcel: ParcelModel) {
    if (parcel.tempItems) {
      return parcel.tempItems;
    }
    return this.orderLoader.getOrderItemsByParcelId.load(parcel.id);
  }

  @ResolveField('supplierDeliveryDate', () => Date, {
    nullable: true,
  })
  async supplierDeliveryDate(@Parent() parcel: ParcelModel) {
    return this.parcelLoader.getSupplierDeliveryDate.load(parcel.id);
  }

  @ResolveField('shipping', () => ShippingModel, { nullable: true })
  @FieldRole(RoleType.seller)
  async shipping(@Parent() parcel: ParcelModel) {
    if (parcel.id) {
      // parcel.shipping is now a @OneToMany (unordered array), so always go
      // through the loader, which returns the latest shipping per parcel.
      return this.shippingLoader.getShippingByParcelId.load(parcel.id);
    }
    return null;
  }

  @Query(() => PaginatedParcel)
  async adminParcelsGet(@Args({ type: () => ParcelQuery }) query: ParcelQuery) {
    return this.orderService.getParcels(query);
  }

  @Query(() => PaginatedParcelWithDelayedItems)
  @Roles([RoleType.seller])
  async sellerParcelsGet(
    @Args('query', { type: () => GetSellerOrders }) query: GetSellerOrders,
    @CurrentUser() user: JwtDto,
    @Context() context,
  ) {
    context.supplierUserId = user.id;
    return this.orderService.sellerParcelsGet(query, user.id);
  }

  @Query(() => PaginatedParcel)
  @Roles([RoleType.seller])
  async pickupInStoreParcelsGet(
    @Args({ type: () => GetPickupInStoreParcelsInput })
    query: GetPickupInStoreParcelsInput,
    @CurrentUser() user: JwtDto,
    @Context() context,
  ) {
    context.supplierUserId = user.id;
    return this.orderService.pickupInStoreParcelsGet(
      query,
      user.isAdmin
        ? { isAdmin: true, supplierUserId: undefined }
        : { isAdmin: false, supplierUserId: user.id },
    );
  }

  @Query(() => ParcelModel)
  @Roles([RoleType.seller])
  async pickupInStoreParcelGet(
    @Args('parcelId', { type: () => Int }) parcelId: number,
    @CurrentUser() user: JwtDto,
    @Context() context,
  ) {
    context.supplierUserId = user.id;
    return this.orderService.pickupInStoreParcelGet(parcelId, user.id);
  }

  @Query(() => ParcelModel)
  async adminParcelGet(
    @Args('parcelId', { type: () => Int }) parcelId: number,
  ) {
    return this.orderService.getParcelById(parcelId);
  }

  @Mutation(() => Boolean)
  async adminParcelCancel(
    @Args({ name: 'input', type: () => CancelParcelInput })
    input: CancelParcelInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.parcelService.adminParcelCancel(input, user, true);
  }

  @Mutation(() => Boolean)
  @Roles([RoleType.seller])
  async pickUpInstoreParcelCancel(
    @Args({ name: 'input', type: () => CancelPickUpInstoreParcelInput })
    input: CancelPickUpInstoreParcelInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.parcelService.pickUpInstoreParcelCancel(input, user);
  }

  @Mutation(() => Boolean)
  @Roles([RoleType.seller])
  async sellerParcelCancel(
    @Args({ name: 'input', type: () => CancelParcelInput })
    input: CancelParcelInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.parcelService.sellerParcelCancel(input, user);
  }

  @Mutation(() => Boolean)
  async adminParcelCancelByPass(
    @Args({ name: 'input', type: () => CancelParcelInput })
    input: CancelParcelInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.parcelService.adminParcelCancel(input, user, false);
  }

  @Mutation(() => Boolean)
  async parcelChangeState(
    @Args({ name: 'input', type: () => ParcelChangeStateInput })
    input: ParcelChangeStateInput,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.parcelService.parcelChangeState(input, user);
  }
}
