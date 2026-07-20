import { Injectable, Scope } from '@nestjs/common';
import { OrderService } from '../order.service';
import DataLoader from 'dataloader';
import { IOrderItem } from 'types/interfaces/order/order.interface';

@Injectable({ scope: Scope.REQUEST })
export class OrderItemLoader {
  constructor(private readonly orderService: OrderService) {}

  public readonly getOrderItemById = new DataLoader<number, IOrderItem>(
    async (orderItemIds) => {
      try {
        const orderItems = await this.orderService.getOrderItemById(
          orderItemIds,
        );

        return orderItemIds.map((id) =>
          orderItems.find((orderItem) => orderItem.id === id),
        );
      } catch (error) {
        throw error;
      }
    },
  );

  public readonly isOrderSingleItem = new DataLoader<number, boolean>(
    async (PhysicalItemIds) => {
      try {
        const physicalOrderItems =
          await this.orderService.getPhysicalOrderItemsByPhysicalItemIds(
            PhysicalItemIds,
          );

        return PhysicalItemIds.map((physicalItemId) => {
          const item = physicalOrderItems.find(
            (physicalOrderItem) =>
              physicalOrderItem.physicalItem.id === physicalItemId,
          );
          if (!item) return false;
          return item.parcel.physicalOrderItems.length === 1;
        });
      } catch (error) {
        throw error;
      }
    },
  );
}
