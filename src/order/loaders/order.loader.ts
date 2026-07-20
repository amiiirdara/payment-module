import { forwardRef, Inject, Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { OrderService } from '../order.service';
import {
  IOrder,
  IOrderCancelDescription,
  IOrderEvent,
  IOrderItem,
  IParcel,
} from 'types/interfaces/order/order.interface';
import { PhysicalOrderItemEntity } from 'src/physical-item/entities/physical-order-item.entity';
import { InventoryService } from 'src/physical-item/services/inventory.service';
import { OrderItemEntity } from '../entities/order-item.entity';
import { WrapperType } from 'src/common/utils';

interface OrderKey {
  orderId: number;
  supplierUserId?: number;
}

@Injectable({ scope: Scope.REQUEST })
export class OrderLoader {
  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: WrapperType<OrderService>,
    private readonly inventoryService: InventoryService,
  ) {}

  public readonly getOrderItems = new DataLoader<OrderKey, IOrderItem[]>(
    async (keys) => {
      try {
        const orderIds = keys.map((key) => key.orderId);
        const supplierUserIdSet = new Set(
          keys
            .map((key) => key.supplierUserId)
            .filter((id) => id !== undefined),
        );
        const supplierUserIds = Array.from(supplierUserIdSet);

        let items: IOrderItem[];

        if (supplierUserIds.length > 0) {
          items = await this.orderService.getCartItemsByOrderIdsAndUserIds(
            orderIds,
            supplierUserIds,
          );
        } else {
          items = await this.orderService.getCartItemsbyOrderId(orderIds);
        }
        return keys.map(({ orderId, supplierUserId }) => {
          const orderItems = items.filter(
            (item) =>
              item.orderId === orderId &&
              (supplierUserId === undefined ||
                item.config.supplierUserId === supplierUserId),
          );
          return orderItems.length > 0
            ? orderItems.sort((a, b) => b.id - a.id)
            : null;
        });
      } catch (error) {
        throw error;
      }
    },
  );

  public readonly getOrderById = new DataLoader<number, IOrder>(
    async (orderIds) => {
      try {
        const orders = await this.orderService.getOrderByIds(orderIds);

        return orderIds.map((id) => orders.find((order) => order.id === id));
      } catch (error) {
        throw error;
      }
    },
  );

  public readonly getPhysicalOrderItemsByParcelId = new DataLoader<
    number,
    PhysicalOrderItemEntity[]
  >(async (parcelIds) => {
    try {
      const physicalOrderItems =
        await this.inventoryService.getPhysicalOrderItemsByParcelIds(parcelIds);

      return parcelIds.map((id) =>
        physicalOrderItems.filter((item) => item.parcelId === id),
      );
    } catch (error) {
      throw error;
    }
  });

  public readonly getOrderItemsByParcelId = new DataLoader<
    number,
    OrderItemEntity[]
  >(async (parcelIds) => {
    try {
      const physicalOrderItems =
        await this.orderService.getOrderItemsByParcelIds(parcelIds);

      return parcelIds.map((id) =>
        physicalOrderItems.filter((item) => item.tempParcelId === id),
      );
    } catch (error) {
      throw error;
    }
  });

  public readonly getParcelById = new DataLoader<number, IParcel>(
    async (parcelIds) => {
      try {
        const parcels = await this.orderService.getParcelByIds(parcelIds);
        const result = parcelIds.map((id) =>
          parcels.find((parcel) => parcel.id === id),
        );
        return result;
      } catch (error) {
        throw error;
      }
    },
  );

  public readonly getParcelsByOrderId = new DataLoader<number, IOrderEvent[]>(
    async (orderIds) => {
      try {
        let result;

        const parcels = await this.orderService.getParcelsByOrderIds(orderIds);

        if (parcels) {
          result = orderIds.map((id) =>
            parcels.filter((parcel) => parcel.orderId === id),
          );
          return result;
        } else {
          return [];
        }
      } catch (error) {
        throw error;
      }
    },
  );

  public readonly getEvensByOrderId = new DataLoader<number, IOrderEvent[]>(
    async (orderIds) => {
      try {
        let result;

        const orderEvents = await this.orderService.getOrderEventsByOrderIds(
          orderIds,
        );

        if (orderEvents) {
          result = orderIds.map((id) =>
            orderEvents.filter((orderEvent) => orderEvent.orderId === id),
          );
          return result;
        } else {
          return [];
        }
      } catch (error) {
        throw error;
      }
    },
  );

  public readonly getEvensByParcelId = new DataLoader<number, IOrderEvent[]>(
    async (parcelIds) => {
      try {
        let result;

        const orderEvents = await this.orderService.getOrderEventsByParcelIds(
          parcelIds,
        );

        if (orderEvents) {
          result = parcelIds.map((id) =>
            orderEvents.filter((orderEvent) => orderEvent.parcelId === id),
          );
          return result;
        } else {
          return [];
        }
      } catch (error) {
        throw error;
      }
    },
  );

  public readonly getOrderCancellation = new DataLoader<
    number,
    IOrderCancelDescription
  >(async (orderIds) => {
    try {
      const cancellations =
        await this.orderService.getOrderCancellationsByOrderIds(orderIds);

      return orderIds.map((id) =>
        cancellations.find((cancellation) => cancellation.orderId === id),
      );
    } catch (error) {
      throw error;
    }
  });
}
