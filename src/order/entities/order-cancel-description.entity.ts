import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import {
  IOrderCancelDescription,
  OrderCancelReason,
} from 'types/interfaces/order/order.interface';
import { OrderEntity } from './order.entity';

@Entity()
export class OrderCancelDescriptionEntity implements IOrderCancelDescription {
  @PrimaryColumn()
  orderId: number;

  @Column('enum', { enum: OrderCancelReason })
  cancelReason: OrderCancelReason;

  @Column('text', { nullable: true })
  cancelDescription?: string;

  @OneToOne(() => OrderEntity, (order) => order.cancellation, { cascade: true })
  @JoinColumn({ name: 'orderid' })
  order: Relation<OrderEntity>;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;
}
