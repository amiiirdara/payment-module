import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { In, QueryRunner } from 'typeorm';
import { Utils, WrapperType } from 'src/common/utils';
import {
  OrderEventTypeEnum,
  ParcelShippingCourier,
  ParcelStateEnum,
} from 'types/interfaces/order/order.interface';
import { ParcelEntity } from '../entities/parcel.entity';
import { OrderEventEntity } from '../entities/order-events.entity';
import { OrderService } from '../order.service';

@Injectable()
export class ParcelChangeStateService {
  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: WrapperType<OrderService>,
  ) {}

  /**
   * A mapping of allowed state transitions for parcel.
   * Each key represents a current state, and its value is an array
   * of possible next states that the item can transition to.
   *
   * @type {Record<ParcelStateEnum, ParcelStateEnum[]>}
   */
  static validTransitions: Record<ParcelStateEnum, ParcelStateEnum[]> = {
    [ParcelStateEnum.INITIAL]: [ParcelStateEnum.PAYMENT_PENDING],
    [ParcelStateEnum.PAYMENT_PENDING]: [
      ParcelStateEnum.PROCESSING,
      ParcelStateEnum.WAITING_FOR_SELLER_CONFIRM,
      ParcelStateEnum.PICKUP_IN_STORE_DELIVERED,
      ParcelStateEnum.CANCELLED_ADMIN,
    ],
    [ParcelStateEnum.WAITING_FOR_SELLER_CONFIRM]: [
      ParcelStateEnum.PROCESSING,
      ParcelStateEnum.CANCELLED_ADMIN,
    ],
    [ParcelStateEnum.PROCESSING]: [
      ParcelStateEnum.WAITING_FOR_PACKING,
      ParcelStateEnum.SELLER_WAITING_FOR_SHIPMENT,
      ParcelStateEnum.CANCELLED_ADMIN,
    ],
    [ParcelStateEnum.WAITING_FOR_PACKING]: [
      ParcelStateEnum.WAITING_FOR_SHIPMENT,
      ParcelStateEnum.CANCELLED_ADMIN,
    ],
    [ParcelStateEnum.WAITING_FOR_SHIPMENT]: [
      ParcelStateEnum.SHIPPED,
      ParcelStateEnum.CANCELLED_ADMIN,
    ],
    [ParcelStateEnum.SELLER_WAITING_FOR_SHIPMENT]: [
      ParcelStateEnum.SELLER_SHIPPED,
      ParcelStateEnum.CANCELLED_ADMIN,
    ],
    [ParcelStateEnum.SHIPPED]: [
      ParcelStateEnum.SHIPPED,
      ParcelStateEnum.DELIVERED,
      // Post-pickup SnappBox cancel / failed-delivery-return-to-source rolls
      // an AUTOMOBY parcel back to WAITING_FOR_PACKING so the warehouse can
      // re-inspect/re-pack before adminWatingForShipment re-dispatches.
      ParcelStateEnum.WAITING_FOR_PACKING,
    ],
    [ParcelStateEnum.SELLER_SHIPPED]: [
      ParcelStateEnum.SELLER_DELIVERED,
      ParcelStateEnum.PROCESSING,
    ],
    [ParcelStateEnum.DELIVERED]: [ParcelStateEnum.CANCELLED_ADMIN],
    [ParcelStateEnum.SELLER_DELIVERED]: [ParcelStateEnum.CANCELLED_ADMIN],
    [ParcelStateEnum.PICKUP_IN_STORE_DELIVERED]: [
      ParcelStateEnum.CANCELLED_ADMIN,
      ParcelStateEnum.CANCELLED_SYSTEM,
    ],
    [ParcelStateEnum.CANCELLED_ADMIN]: [],
    [ParcelStateEnum.CANCELLED_SYSTEM]: [],
  };

  public async changeState(
    id: number,
    newState: ParcelStateEnum,
    queryRunner: QueryRunner,
    data?: any,
  ): Promise<void> {
    // Acquire SELECT ... FOR UPDATE on the parcel row so concurrent callers
    // serialize on the read-validate-update sequence. Without this, two
    // transactions can both pass isValidTransition() against the same
    // pre-image and both succeed their blind UPDATE, since manager.update
    // has no WHERE state guard. See adminWatingForShipment + SnappBox dispatch.
    const parcle = await queryRunner.manager.findOne(ParcelEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!parcle) {
      throw new BadRequestException(
        Utils.generateErrorForOperation(
          'مرسوله مورد نظر پیدا نشد',
          ['وضعیتی که قرار بود بره', newState],
          ['ایدی تامین مورد نظر که پیدا نشد', id],
          ['دیتا های اضافی ارسال شده', data],
        ),
      );
    }

    // check allowed state change
    if (!this.isValidTransition(parcle.state, newState)) {
      throw new BadRequestException(
        Utils.generateErrorForOperation(
          'امکان رفتن به وضعیت درخواست شده وجود ندارد',
          ['وضعیتی که الان هست', parcle.state],
          ['وضعیتی که قرار بود بره', newState],
        ),
      );
    }

    // Change state
    await queryRunner.manager.update(ParcelEntity, id, {
      state: newState,
    });

    //Central log
    await this.orderService.logOrderEvent(
      newState ? newState : null,
      null,
      data?.userId,
      parcle.orderId,
      parcle.id,
      queryRunner,
      data?.shippingCourier ? data.shippingCourier : null,
    );

    // Do actions based on the state change with a switch statement
    switch (newState) {
      case ParcelStateEnum.INITIAL:
        // no action . . .
        break;

      case ParcelStateEnum.PROCESSING:
        // code . . .
        break;

      case ParcelStateEnum.WAITING_FOR_PACKING:
        // code . . .
        break;

      case ParcelStateEnum.WAITING_FOR_SHIPMENT:
        // code . . .
        break;

      case ParcelStateEnum.SELLER_WAITING_FOR_SHIPMENT:
        // code . . .
        break;

      case ParcelStateEnum.SHIPPED:
        // code . . .
        break;

      case ParcelStateEnum.SELLER_SHIPPED:

      // code . . .        break;

      case ParcelStateEnum.DELIVERED:
        // code . . .
        break;

      case ParcelStateEnum.SELLER_DELIVERED:
        // code . . .
        break;

      case ParcelStateEnum.PICKUP_IN_STORE_DELIVERED:
        // Pickup in store order delivered
        break;

      case ParcelStateEnum.CANCELLED_ADMIN:
        break;

      case ParcelStateEnum.CANCELLED_SYSTEM:
        // code . . .
        break;
    }
  }

  /**
   * Bulk variant of changeState for callers that transition many parcels at
   * once inside a single transaction. Collapses the per-parcel work into a
   * constant number of queries instead of one set of queries per parcel:
   *   1) one locked read of every parcel (SELECT ... FOR UPDATE)
   *   2) in-memory validation of every transition (all-or-nothing)
   *   3) one parcel UPDATE per distinct target state (never one per parcel)
   *   4) one read of the latest LOG event per affected order
   *   5) one UPDATE stamping those events' durationInState
   *   6) one multi-row INSERT for the new LOG events
   *
   * NOTE: it runs none of changeState's per-state switch side-effects, so it
   * must only be used for transitions whose switch case is a no-op (currently
   * DELIVERED / SELLER_DELIVERED). For any other target state use changeState.
   */
  public async changeStateBulk(
    items: {
      id: number;
      newState: ParcelStateEnum;
      shippingCourier?: ParcelShippingCourier;
    }[],
    queryRunner: QueryRunner,
    data?: { userId?: number },
  ): Promise<void> {
    if (!items.length) return;

    const ids = items.map((i) => i.id);

    // 1) Lock and read every parcel up front in a consistent id order (same
    // SELECT ... FOR UPDATE guard changeState applies per row, batched).
    const parcels = await queryRunner.manager.find(ParcelEntity, {
      where: { id: In(ids) },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const parcelById = new Map(parcels.map((p) => [p.id, p]));

    // 2) Validate every parcel/transition before any write. A single bad item
    // aborts the whole batch (the caller's transaction rolls back).
    for (const item of items) {
      const parcel = parcelById.get(item.id);
      if (!parcel) {
        throw new BadRequestException(
          Utils.generateErrorForOperation(
            'مرسوله مورد نظر پیدا نشد',
            ['وضعیتی که قرار بود بره', item.newState],
            ['ایدی مرسوله مورد نظر که پیدا نشد', item.id],
          ),
        );
      }
      if (!this.isValidTransition(parcel.state, item.newState)) {
        throw new BadRequestException(
          Utils.generateErrorForOperation(
            'امکان رفتن به وضعیت درخواست شده وجود ندارد',
            ['وضعیتی که الان هست', parcel.state],
            ['وضعیتی که قرار بود بره', item.newState],
          ),
        );
      }
    }

    // 3) Update parcel states grouped by target state: one UPDATE per distinct
    // state (bounded by the enum), not one per parcel.
    const idsByNewState = new Map<ParcelStateEnum, number[]>();
    for (const item of items) {
      const group = idsByNewState.get(item.newState) ?? [];
      group.push(item.id);
      idsByNewState.set(item.newState, group);
    }
    for (const [state, stateIds] of idsByNewState) {
      await queryRunner.manager.update(
        ParcelEntity,
        { id: In(stateIds) },
        { state },
      );
    }

    // 4) Central log — fetch the latest LOG event per affected order in one
    // query (DISTINCT ON orderId, newest first).
    const orderIds = [...new Set(parcels.map((p) => p.orderId))];
    const latestEvents = await queryRunner.manager
      .createQueryBuilder(OrderEventEntity, 'e')
      .distinctOn(['e.orderId'])
      .where('e.orderId IN (:...orderIds)', { orderIds })
      .andWhere('e.type = :logType', { logType: OrderEventTypeEnum.LOG })
      .orderBy('e.orderId', 'ASC')
      .addOrderBy('e.createdDate', 'DESC')
      .getMany();

    // 5) Stamp durationInState on those previous events in a single UPDATE
    // (CASE per id, cast to interval). Mirrors logOrderEvent's duration write.
    if (latestEvents.length) {
      const now = Date.now();
      const durationParams: Record<string, unknown> = {};
      const durationCases: string[] = [];
      const eventIds: number[] = [];
      latestEvents.forEach((event, i) => {
        durationCases.push(`WHEN "id" = :eid${i} THEN :edur${i}::interval`);
        durationParams[`eid${i}`] = event.id;
        durationParams[`edur${i}`] = Utils.calculateDurationInState(
          now,
          event.createdDate.getTime(),
        );
        eventIds.push(event.id);
      });
      await queryRunner.manager
        .createQueryBuilder()
        .update(OrderEventEntity)
        .set({ durationInState: () => `CASE ${durationCases.join(' ')} END` })
        .where({ id: In(eventIds) })
        .setParameters(durationParams)
        .execute();
    }

    // 6) Insert all new LOG events in one multi-row INSERT.
    const newEvents = items.map((item) => {
      const parcel = parcelById.get(item.id)!;
      return {
        type: OrderEventTypeEnum.LOG,
        userId: data?.userId,
        orderId: parcel.orderId,
        parcelId: parcel.id,
        parcelState: item.newState,
        ...(item.shippingCourier
          ? { shippingCourier: item.shippingCourier }
          : {}),
      };
    });
    await queryRunner.manager.insert(OrderEventEntity, newEvents);
  }

  private isValidTransition(
    oldState: ParcelStateEnum,
    newState: ParcelStateEnum,
  ): boolean {
    return ParcelChangeStateService.validTransitions[oldState].includes(
      newState,
    );
  }
}
