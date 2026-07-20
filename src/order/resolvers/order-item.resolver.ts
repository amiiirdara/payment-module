import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { GQLAuth } from 'src/auth/auth.decorator';
import { OrderLoader } from '../loaders/order.loader';
import { OrderItemModel } from '../models/order-item.model';
import { CarPartConfigModel } from '../../car-part/models/car-part-config.model';
import { CarPartLoader } from '../../car-part/loaders/car-part.loader';
import { FieldRole } from '../../access-control/access-control.middleware';
import { RoleType } from '../../auth/roles.enum';
import { OrderModel } from '../models/order.model';
import { PhysicalOrderItemLoader } from 'src/physical-item/loader/physical-order-item.loader';
import { PhysicalOrderItemModel } from 'src/physical-item/models/physical-order-item.model';

@Resolver(() => OrderItemModel)
@GQLAuth()
export class OrderItemResolver {
  constructor(
    private orderLoader: OrderLoader,
    private carPartLoader: CarPartLoader,
    private physicalOrderItemLoader: PhysicalOrderItemLoader,
  ) {}

  @ResolveField('config', () => CarPartConfigModel)
  @FieldRole(RoleType.seller)
  async resolveConfigCarPart(@Parent() orderItem: OrderItemModel) {
    if (orderItem.config) {
      return orderItem.config;
    }
    return this.carPartLoader.getCarPartConfigById.load(orderItem.configId);
  }

  @ResolveField('order', () => OrderModel)
  @FieldRole(RoleType.seller)
  async resolveOrder(@Parent() orderItem: OrderItemModel) {
    return this.orderLoader.getOrderById.load(orderItem.orderId);
  }

  @ResolveField('physicalOrderItems', () => [PhysicalOrderItemModel], {
    nullable: true,
  })
  @FieldRole(RoleType.seller)
  async resolvePhysicalOrderItems(@Parent() orderItem: OrderItemModel) {
    return this.physicalOrderItemLoader.getPhysicalOrderItemsByOrderId.load(
      orderItem.id,
    );
  }
}
