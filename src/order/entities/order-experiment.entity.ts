import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { OrderEntity } from './order.entity';

@Entity('order_experiments')
export class OrderExperimentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  orderId: number;

  @Column({ nullable: true })
  experimentId: number;

  @Column({ nullable: true })
  variantId: number;

  @OneToOne(() => OrderEntity, (order) => order.experiment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orderid' })
  order: Relation<OrderEntity>;
}
