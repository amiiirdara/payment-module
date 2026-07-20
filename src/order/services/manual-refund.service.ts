import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { LoggerService } from 'src/common/logger/logger.service';
import { User } from 'src/users/users.entity';
import { PaymentTransactionState } from 'src/types/interfaces/payment/payment.interface';

import { ManualRefundEntity } from '../entities/manual-refund.entity';
import { ManualRefundStateEnum } from 'src/types/interfaces/order/manual-refund.interface';
import { OrderEntity } from '../entities/order.entity';
import { PaymentTransactionEntity } from '../../payments/entities/payment-transaciont.entity';
import {
  ManualRefundModel,
  PaginatedManualRefundsModel,
} from '../models/manual-refund.model';

/**
 * ManualRefundService — admin lifecycle for ManualRefundEntity rows.
 *
 * RefundService CREATES these rows (PENDING_REFUND) when a gateway can't refund
 * automatically. This service is the admin/support side that lists them and
 * walks the state machine:
 *
 *   PENDING_REFUND ─▶ REFUNDED                       (support deposited)
 *   PENDING_REFUND ◀─▶ NEED_TO_USERS_CORRECT_SHEBA   (bad/missing IBAN)
 *
 * The negative PaymentTransaction (the actual ledger entry) is recorded ONLY at
 * the REFUNDED transition — with a snapshot of the user's sheba at that instant
 * — so until then the gap between order.totalPrice (already reduced at cancel)
 * and the transaction ledger is exactly the outstanding obligation.
 *
 * Kept separate from RefundService (which is a leaf, creation-time dispatcher)
 * so RefundService stays free of admin/query concerns and DI cycles.
 */
@Injectable()
export class ManualRefundService {
  constructor(
    @InjectRepository(ManualRefundEntity)
    private readonly manualRefundRepo: Repository<ManualRefundEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Admin list for the generalTable panel. Filters on state / orderId / userId,
   * newest first, paginated. Enriches each row with the user's name, phone, and
   * CURRENT sheba so support knows who/where to pay.
   */
  async adminList(params: {
    state?: ManualRefundStateEnum[];
    orderId?: number;
    userId?: number;
    page: number;
    limit: number;
  }): Promise<PaginatedManualRefundsModel> {
    const { state, orderId, userId, page, limit } = params;

    const where: Record<string, unknown> = {};
    if (state?.length) where.state = In(state);
    if (orderId != null) where.orderId = orderId;
    if (userId != null) where.userId = userId;

    const [rows, total] = await this.manualRefundRepo.findAndCount({
      where,
      order: { createDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Batch-load users once (no N+1).
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = userIds.length
      ? await this.dataSource.manager.find(User, {
          where: { id: In(userIds) },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            sheba: true,
          },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    const items: ManualRefundModel[] = rows.map((r) => {
      const u = byId.get(r.userId);
      const fullName = u
        ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null
        : null;
      return {
        id: r.id,
        orderId: r.orderId,
        userId: r.userId,
        amount: r.amount,
        description: r.description,
        paymentGateway: r.paymentGateway,
        state: r.state,
        refundedByUserId: r.refundedByUserId,
        refundedAt: r.refundedAt,
        createDate: r.createDate,
        updateDate: r.updateDate,
        userFullName: fullName,
        userPhoneNumber: u?.phoneNumber ?? null,
        userCurrentSheba: u?.sheba ?? null,
      };
    });

    return { items, total };
  }

  /**
   * PENDING_REFUND → REFUNDED. Records the negative PaymentTransaction
   * (price = -amount, SUCCESS) with a snapshot of the user's sheba, plus
   * refundedByUserId / refundedAt. Idempotent via the deterministic
   * `MANUAL-REFUND-${id}` extraInfo key and a pessimistic row lock.
   *
   * Refuses if the user's sheba is empty — the admin must first flag
   * NEED_TO_USERS_CORRECT_SHEBA and have the user fix it.
   */
  async markRefunded(
    manualRefundId: number,
    adminUserId: number,
    description?: string,
  ): Promise<ManualRefundEntity> {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(ManualRefundEntity, {
        where: { id: manualRefundId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw new NotFoundException(
          `Manual refund ${manualRefundId} not found`,
        );
      }
      if (row.state !== ManualRefundStateEnum.PENDING_REFUND) {
        throw new BadRequestException(
          'فقط ردیفی که در وضعیت PENDING_REFUND است قابل واریز (REFUNDED) است.',
        );
      }

      const user = await manager.findOne(User, {
        where: { id: row.userId },
        select: { id: true, sheba: true },
      });
      const sheba = user?.sheba?.trim();
      if (!sheba) {
        throw new BadRequestException(
          'شبای کاربر خالی است؛ ابتدا وضعیت را NEED_TO_USERS_CORRECT_SHEBA کنید تا کاربر آن را اصلاح کند.',
        );
      }

      const order = await manager.findOne(OrderEntity, {
        where: { id: row.orderId },
        select: { id: true, paymentId: true },
      });
      if (!order) {
        throw new BadRequestException(`Order ${row.orderId} not found`);
      }

      // Idempotent ledger entry — skip if a prior REFUNDED already wrote it.
      const idempotencyKey = `MANUAL-REFUND-${row.id}`;
      const existing = await manager.findOne(PaymentTransactionEntity, {
        where: { paymentId: order.paymentId, extraInfo: idempotencyKey },
      });
      if (!existing) {
        const mainTx = await manager.findOne(PaymentTransactionEntity, {
          where: {
            paymentId: order.paymentId,
            state: PaymentTransactionState.SUCCESS,
          },
          order: { id: 'ASC' },
        });
        if (!mainTx) {
          throw new BadRequestException(
            `No successful payment transaction for order ${order.id}`,
          );
        }
        await manager.save(PaymentTransactionEntity, {
          paymentId: order.paymentId,
          price: -row.amount,
          state: PaymentTransactionState.SUCCESS,
          paymentType: mainTx.paymentType,
          portalName: mainTx.portalName,
          extraInfo: idempotencyKey,
          shebaNumber: sheba,
        } as PaymentTransactionEntity);
      }

      row.state = ManualRefundStateEnum.REFUNDED;
      row.refundedByUserId = adminUserId;
      row.refundedAt = new Date();
      // Optional admin note recorded at approval time; overwrite only when a
      // non-empty description is supplied so an existing note isn't wiped.
      const trimmedDescription = description?.trim();
      if (trimmedDescription) row.description = trimmedDescription;
      const saved = await manager.save(ManualRefundEntity, row);

      this.logger.log(
        `Manual refund ${row.id} marked REFUNDED by user ${adminUserId} (amount ${row.amount}, sheba snapshot taken)`,
        'ManualRefundService',
      );
      return saved;
    });
  }

  /**
   * PENDING_REFUND → NEED_TO_USERS_CORRECT_SHEBA — block the deposit because the
   * user's IBAN is missing/invalid. Optionally records a reason in `description`.
   */
  async markNeedCorrectSheba(
    manualRefundId: number,
    description?: string,
  ): Promise<ManualRefundEntity> {
    const row = await this.manualRefundRepo.findOne({
      where: { id: manualRefundId },
    });
    if (!row) {
      throw new NotFoundException(`Manual refund ${manualRefundId} not found`);
    }
    if (row.state !== ManualRefundStateEnum.PENDING_REFUND) {
      throw new BadRequestException(
        'فقط از وضعیت PENDING_REFUND می‌توان به NEED_TO_USERS_CORRECT_SHEBA رفت.',
      );
    }
    row.state = ManualRefundStateEnum.NEED_TO_USERS_CORRECT_SHEBA;
    if (description !== undefined) row.description = description;
    return this.manualRefundRepo.save(row);
  }

  /**
   * NEED_TO_USERS_CORRECT_SHEBA → PENDING_REFUND — the user fixed their IBAN, so
   * the refund is depositable again.
   */
  async revertToPending(manualRefundId: number): Promise<ManualRefundEntity> {
    const row = await this.manualRefundRepo.findOne({
      where: { id: manualRefundId },
    });
    if (!row) {
      throw new NotFoundException(`Manual refund ${manualRefundId} not found`);
    }
    if (row.state !== ManualRefundStateEnum.NEED_TO_USERS_CORRECT_SHEBA) {
      throw new BadRequestException(
        'فقط از وضعیت NEED_TO_USERS_CORRECT_SHEBA می‌توان به PENDING_REFUND بازگشت.',
      );
    }
    row.state = ManualRefundStateEnum.PENDING_REFUND;
    return this.manualRefundRepo.save(row);
  }
}
