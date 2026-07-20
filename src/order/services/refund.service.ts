import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from 'src/common/logger/logger.service';
import { TaraPayment } from 'src/common/payment/tara.util';
import { SnappPay } from 'src/common/payment/snapp-pay.util';
import { TorobPay } from 'src/common/payment/torob-pay.util';
import { DigipayService } from 'src/digipay/digipay.service';
import { AzkiService } from 'src/azki/azki.service';
import { ZarinPlusService } from 'src/zarinplus/zarinplus.service';
import { EwanoService } from 'src/ewano/ewano.service';
import {
  PaymentTransactionState,
  PaymentType,
} from 'src/types/interfaces/payment/payment.interface';
import { ManualRefundStateEnum } from 'src/types/interfaces/order/manual-refund.interface';
import { User } from 'src/users/users.entity';

import { OrderEntity } from '../entities/order.entity';
import { ManualRefundEntity } from '../entities/manual-refund.entity';
import { PaymentTransactionEntity } from '../../payments/entities/payment-transaciont.entity';
import { SnappPayUpdateDto } from '../dto/order.dto';

export type RefundMode =
  | 'AUTO' // gateway refunded + negative transaction recorded
  | 'MANUAL' // ManualRefundEntity row created, support deposits out of band
  | 'NOOP' // internal-credit gateway (KEEPA/ITOL) — nothing to refund
  | 'ALREADY_DONE'; // idempotent no-op (already refunded for this key)

/**
 * Gateways that support a true amount-based PARTIAL refund WITHOUT a cart.
 * SNAPP_PAY/TOROB_PAY also support partial, but only via a payment-update
 * (`update`) that re-issues the reduced cart — the caller passes that cart as
 * `reissueCart` (built from remaining goods AND/OR remaining installation
 * reserves) and those two then run AUTO too (see refundPartial). Without a cart
 * they fall back to a manual row.
 */
const PARTIAL_AUTO_GATEWAYS: ReadonlySet<PaymentType> = new Set([
  PaymentType.TARA,
  PaymentType.DIGI_PAY,
]);

/** Internal-credit methods with no external gateway — never refunded. */
const NOOP_GATEWAYS: ReadonlySet<PaymentType> = new Set([
  PaymentType.KEEPA,
  PaymentType.ITOL,
]);

/**
 * RefundService — single, gateway-complete owner of refund dispatch.
 *
 * Leaf service (injects the gateway providers directly, NOT OrderService), so
 * order / parcel / installation can all use it without cycles.
 *
 *  - refundFull:    full reverse of the order's remaining balance, per gateway.
 *  - refundPartial: refund a specific amount, per gateway.
 *
 * Manual gateways (SAMAN — no reverse at all; and partial on
 * EWANO/ZARINPLUS/AZKI, plus SNAPP/TOROB when no reissueCart is given) record a
 * ManualRefundEntity row and NO negative transaction until support marks it
 * REFUNDED. KEEPA/ITOL are internal credit → no-op.
 *
 * As of the goods migration (_design/refund-decisions.md §6, phase 5) this is
 * the SINGLE owner of refund dispatch: OrderService.cancelOrderThirdPartyAndSendSms
 * (→ refundFull) and editOrderThirdParty (→ refundPartial with reissueCart) both
 * delegate here. The checkout-time compensation path
 * (compensatePaymentIfNeededForGateway) is separate and intentionally not routed
 * through this service.
 */
@Injectable()
export class RefundService {
  constructor(
    @InjectRepository(ManualRefundEntity)
    private readonly manualRefundRepo: Repository<ManualRefundEntity>,
    private readonly tara: TaraPayment,
    private readonly snapp: SnappPay,
    private readonly torob: TorobPay,
    private readonly digipayService: DigipayService,
    private readonly azkiService: AzkiService,
    private readonly zarinPlusService: ZarinPlusService,
    private readonly ewanoService: EwanoService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Full reverse of `amount` (the order's whole remaining balance) — used when a
   * cancellation leaves the entire order cancelled. Works for every gateway:
   * auto reverse + negative transaction, a manual row for SAMAN, or no-op for
   * internal credit. Does NOT touch order.totalPrice (terminal cancel).
   */
  async refundFull(params: {
    order: OrderEntity;
    amount: number;
    userId: number;
    idempotencyKey: string;
    manager: EntityManager;
    callThirdParty: boolean;
    description?: string;
  }): Promise<RefundMode> {
    const { order, amount, userId, idempotencyKey, manager, callThirdParty } =
      params;
    if (amount <= 0) return 'ALREADY_DONE';
    if (await this.alreadyRefunded(manager, order, idempotencyKey)) {
      return 'ALREADY_DONE';
    }
    const mainTx = await this.findMainTransaction(manager, order);
    const gateway = mainTx.paymentType;

    if (NOOP_GATEWAYS.has(gateway)) return 'NOOP';

    // SAMAN has neither full nor partial reverse → always manual.
    if (gateway === PaymentType.SAMAN) {
      await this.createManualRefund(
        manager,
        order,
        userId,
        amount,
        gateway,
        params.description,
      );
      return 'MANUAL';
    }

    // TARA full-reverse must NOT use allRefund when the payment already has more
    // than one SUCCESS transaction (e.g. prior partial refunds): allRefund would
    // reverse the original gross, double-refunding what was already returned. In
    // that case reverse the net-remaining amount via partialRefund. Count BEFORE
    // recordAutoRefund inserts its own (pending) negative row.
    const successTxCount = await manager.count(PaymentTransactionEntity, {
      where: {
        paymentId: order.paymentId,
        state: PaymentTransactionState.SUCCESS,
      },
    });

    await this.recordAutoRefund(
      manager,
      order,
      mainTx,
      amount,
      idempotencyKey,
      async () => {
        await this.reverseFullToGateway(
          gateway,
          mainTx,
          userId,
          amount,
          callThirdParty,
          successTxCount,
        );
      },
    );
    return 'AUTO';
  }

  /**
   * Refund a specific `amount` while leaving the rest of the order paid — used
   * when a cancellation is partial (goods or other reserves remain). Reduces
   * order.totalPrice by `amount` (the net-remaining ledger). Auto for the
   * amount-based gateways, otherwise a manual row.
   */
  async refundPartial(params: {
    order: OrderEntity;
    amount: number;
    userId: number;
    idempotencyKey: string;
    manager: EntityManager;
    callThirdParty: boolean;
    description?: string;
    /**
     * Whether to subtract `amount` from order.totalPrice here. Default true (the
     * installation path). The goods path (editOrderThirdParty) computes the new
     * totalPrice itself (shipping + discount aware) and sets it before calling,
     * so it passes false to avoid double-subtracting.
     */
    reduceTotalPrice?: boolean;
    /**
     * Pre-built SnappPay/TorobPay payment-update payload representing the reduced
     * cart (remaining goods AND/OR remaining installation reserves). When present
     * and the gateway is SNAPP_PAY/TOROB_PAY, the partial refund runs AUTO via
     * snapp/torob `update` (the gateway recomputes from the reduced cart). The
     * caller owns building the cart (it is the only side that knows what remains);
     * RefundService only dispatches. Absent → SNAPP/TOROB fall back to a manual row.
     */
    reissueCart?: SnappPayUpdateDto;
  }): Promise<RefundMode> {
    const { order, amount, userId, idempotencyKey, manager, callThirdParty } =
      params;
    if (amount <= 0) return 'ALREADY_DONE';
    if (await this.alreadyRefunded(manager, order, idempotencyKey)) {
      return 'ALREADY_DONE';
    }
    const mainTx = await this.findMainTransaction(manager, order);
    const gateway = mainTx.paymentType;

    if (NOOP_GATEWAYS.has(gateway)) return 'NOOP';

    // Reduce the net-remaining balance regardless of auto/manual, so a later
    // full cancel doesn't refund this share again (mirrors editOrderThirdParty).
    // Skipped when the caller already set totalPrice (goods edit flow).
    if (params.reduceTotalPrice ?? true) {
      await manager.update(
        OrderEntity,
        { id: order.id },
        { totalPrice: order.totalPrice - amount },
      );
    }

    // SNAPP/TOROB partial is auto only when the caller supplied the re-issue cart
    // (remaining goods and/or remaining installation reserves).
    const canAutoReissueCart =
      !!params.reissueCart &&
      (gateway === PaymentType.SNAPP_PAY || gateway === PaymentType.TOROB_PAY);
    const canAuto =
      callThirdParty &&
      (PARTIAL_AUTO_GATEWAYS.has(gateway) || canAutoReissueCart);
    if (!canAuto) {
      await this.createManualRefund(
        manager,
        order,
        userId,
        amount,
        gateway,
        params.description,
      );
      return 'MANUAL';
    }

    await this.recordAutoRefund(
      manager,
      order,
      mainTx,
      amount,
      idempotencyKey,
      async () => {
        await this.partialToGateway(
          gateway,
          mainTx,
          amount,
          params.reissueCart,
        );
      },
    );
    return 'AUTO';
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async alreadyRefunded(
    manager: EntityManager,
    order: OrderEntity,
    idempotencyKey: string,
  ): Promise<boolean> {
    const existing = await manager.findOne(PaymentTransactionEntity, {
      where: { paymentId: order.paymentId, extraInfo: idempotencyKey },
    });
    return !!existing;
  }

  private async findMainTransaction(
    manager: EntityManager,
    order: OrderEntity,
  ): Promise<PaymentTransactionEntity> {
    const tx = await manager.findOne(PaymentTransactionEntity, {
      where: {
        paymentId: order.paymentId,
        state: PaymentTransactionState.SUCCESS,
      },
      order: { id: 'ASC' },
    });
    if (!tx) {
      throw new BadRequestException(
        `No successful payment transaction for order ${order.id}`,
      );
    }
    return tx;
  }

  /**
   * Record the negative transaction as PENDING, call the gateway, then flip to
   * SUCCESS — so a crash between gateway-ok and DB-commit leaves a PENDING marker
   * that blocks re-issue (idempotencyKey) and flags for review.
   */
  private async recordAutoRefund(
    manager: EntityManager,
    order: OrderEntity,
    mainTx: PaymentTransactionEntity,
    amount: number,
    idempotencyKey: string,
    gatewayCall: () => Promise<void>,
  ): Promise<void> {
    const refundTx = await manager.save(PaymentTransactionEntity, {
      paymentId: order.paymentId,
      price: -amount,
      state: PaymentTransactionState.PENDING,
      paymentType: mainTx.paymentType,
      portalName: mainTx.portalName,
      extraInfo: idempotencyKey,
    } as PaymentTransactionEntity);

    await gatewayCall();

    await manager.update(PaymentTransactionEntity, refundTx.id, {
      state: PaymentTransactionState.SUCCESS,
    });
  }

  private async createManualRefund(
    manager: EntityManager,
    order: OrderEntity,
    userId: number,
    amount: number,
    gateway: PaymentType,
    description?: string,
  ): Promise<void> {
    // If the user has no sheba on file, the deposit can't happen yet — start the
    // row already blocked on NEED_TO_USERS_CORRECT_SHEBA (the same rule
    // ManualRefundService.markRefunded enforces at deposit time), pushed to the
    // front of the cycle so support isn't shown a row it can never action.
    const user = await manager.findOne(User, {
      where: { id: userId },
      select: { id: true, sheba: true },
    });
    const state = user?.sheba?.trim()
      ? ManualRefundStateEnum.PENDING_REFUND
      : ManualRefundStateEnum.NEED_TO_USERS_CORRECT_SHEBA;

    await manager.save(ManualRefundEntity, {
      orderId: order.id,
      userId,
      amount,
      description: description ?? null,
      paymentGateway: gateway,
      state,
    } as ManualRefundEntity);
    this.logger.log(
      `Manual refund row created for order ${order.id}: ${amount} (gateway ${gateway}, state ${state})`,
      'RefundService',
    );
  }

  /** Full reverse per gateway (amounts to gateways are Rial = toman × 10). */
  private async reverseFullToGateway(
    gateway: PaymentType,
    mainTx: PaymentTransactionEntity,
    userId: number,
    amount: number,
    callThirdParty: boolean,
    successTxCount: number,
  ): Promise<void> {
    switch (gateway) {
      case PaymentType.SNAPP_PAY:
        await this.snapp.cancel(mainTx.extraInfo);
        return;
      case PaymentType.TOROB_PAY:
        await this.torob.cancel(mainTx.extraInfo);
        return;
      case PaymentType.TARA:
        if (callThirdParty) {
          // Single success tx → reverse it whole; multiple → only the remainder.
          if (successTxCount <= 1) {
            await this.tara.allRefund(mainTx.trackingNumber, userId);
          } else {
            await this.tara.partialRefund(
              mainTx.trackingNumber,
              [],
              amount * 10,
            );
          }
        }
        return;
      case PaymentType.DIGI_PAY:
        await this.digipayService.processRefund({
          amount: amount * 10,
          providerId: uuidv4(),
          saleTrackingCode: mainTx.trackingNumber,
        });
        return;
      case PaymentType.ZARINPLUS:
        if (callThirdParty && mainTx.trackingNumber) {
          await this.zarinPlusService.reversePayment(
            mainTx.trackingNumber,
            mainTx.transactionId,
          );
        }
        return;
      case PaymentType.AZKI:
        if (callThirdParty && mainTx.trackingNumber) {
          await this.azkiService.reverseTicket(mainTx.trackingNumber);
        }
        return;
      case PaymentType.EWANO:
        if (callThirdParty) {
          await this.reverseEwano(mainTx, userId, amount);
        }
        return;
      default:
        throw new BadRequestException(
          `Unsupported gateway for full refund: ${gateway}`,
        );
    }
  }

  private async partialToGateway(
    gateway: PaymentType,
    mainTx: PaymentTransactionEntity,
    amount: number,
    reissueCart?: SnappPayUpdateDto,
  ): Promise<void> {
    switch (gateway) {
      case PaymentType.TARA:
        await this.tara.partialRefund(mainTx.trackingNumber, [], amount * 10);
        return;
      case PaymentType.DIGI_PAY:
        await this.digipayService.processRefund({
          amount: amount * 10,
          providerId: uuidv4(),
          saleTrackingCode: mainTx.trackingNumber,
        });
        return;
      // SNAPP/TOROB partial = re-issue the payment with the reduced cart. The
      // negative transaction is already recorded by recordAutoRefund; the
      // non-prod guard mirrors the legacy editOrderThirdParty behaviour (record
      // the ledger entry, skip the real gateway call off production).
      case PaymentType.SNAPP_PAY:
        if (process.env.NODE_ENV !== 'production') return;
        if (!reissueCart) {
          throw new BadRequestException(
            'SnappPay partial refund requires cart',
          );
        }
        await this.snapp.update(
          reissueCart.amount,
          reissueCart.paymentToken,
          reissueCart.cartList as never,
          reissueCart.discountAmount,
        );
        return;
      case PaymentType.TOROB_PAY:
        if (process.env.NODE_ENV !== 'production') return;
        if (!reissueCart) {
          throw new BadRequestException(
            'TorobPay partial refund requires cart',
          );
        }
        await this.torob.update(
          reissueCart.amount,
          reissueCart.paymentToken,
          reissueCart.cartList as never,
          reissueCart.discountAmount,
        );
        return;
      default:
        // PARTIAL_AUTO_GATEWAYS / reissueCart gate prevents reaching here.
        throw new BadRequestException(
          `Gateway ${gateway} has no automatic partial refund`,
        );
    }
  }

  /** EWANO full cancel with the 401 token-refresh retry (mirrors the order flow). */
  private async reverseEwano(
    mainTx: PaymentTransactionEntity,
    userId: number,
    amount: number,
  ): Promise<void> {
    let resCode = await this.ewanoService.cancellEwanoOrder(
      mainTx.transactionId,
      userId,
      amount,
    );
    if (resCode === 401) {
      const refreshed = await this.ewanoService.validateRefreshToken(userId);
      if (refreshed) {
        resCode = await this.ewanoService.cancellEwanoOrder(
          mainTx.transactionId,
          userId,
          amount,
        );
      }
    }
    if (resCode >= 500) {
      throw new BadRequestException(
        `خطا در لغو سفارش ایوانو (کد خطا: ${resCode})`,
      );
    }
  }
}
