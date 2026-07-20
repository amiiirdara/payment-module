import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';

import { OrderEntity } from './order.entity';

import { ManualRefundStateEnum } from 'src/types/interfaces/order/manual-refund.interface';
import { PaymentType } from 'src/types/interfaces/payment/payment.interface';

/**
 * A manual refund row — created when a cancellation must return money but the
 * payment gateway can't do it automatically (no partial-refund support, or SAMAN
 * which has neither full nor partial reverse). Support deposits to the user's
 * sheba out of band and marks it REFUNDED.
 *
 * Order-level (one row per refund obligation on an order). NO negative
 * PaymentTransaction is recorded until the row reaches REFUNDED — until then the
 * gap between order.totalPrice (already reduced) and the transaction ledger IS
 * this pending obligation.
 */
@Entity()
@Index('IDX_manual_refund_order', ['orderId'])
@Index('IDX_manual_refund_state', ['state'])
export class ManualRefundEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column('int')
  orderId: number;

  @ManyToOne(() => OrderEntity, (order) => order.manualRefunds, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'orderid',
    foreignKeyConstraintName: 'FK_manual_refund_order',
  })
  order: Relation<OrderEntity>;

  /** The customer who should receive the refund. */
  @ApiProperty()
  @Column('int')
  userId: number;

  /** Amount to return to the user (toman, positive). */
  @ApiProperty()
  @Column('int')
  amount: number;

  @ApiProperty({ nullable: true })
  @Column('text', { nullable: true })
  description: string | null;

  /**
   * Snapshot of the payment gateway that funded the order, captured when the row
   * is created (from the order's main SUCCESS transaction). Kept on the row so
   * support sees where the money came from without re-deriving it, and it stays
   * stable even if later transactions on the order change.
   */
  @ApiProperty({ enum: PaymentType, nullable: true })
  @Column('enum', { enum: PaymentType, nullable: true })
  paymentGateway: PaymentType | null;

  @ApiProperty({ enum: ManualRefundStateEnum })
  @Column('enum', {
    enum: ManualRefundStateEnum,
    default: ManualRefundStateEnum.PENDING_REFUND,
  })
  state: ManualRefundStateEnum;

  /** Admin/support user who performed the deposit (set when REFUNDED). */
  @ApiProperty({ nullable: true })
  @Column('int', { nullable: true })
  refundedByUserId: number | null;

  @ApiProperty({ nullable: true })
  @Column('timestamptz', { nullable: true })
  refundedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createDate: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updateDate: Date;
}
