import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/users.entity';
import { OrderEntity } from './order.entity';
import { CarPartConfigEntity } from '../../car-part/entities/car-part-config.entity';
import { IOrderItem } from 'types/interfaces/order/order.interface';
import { PhysicalOrderItemEntity } from 'src/physical-item/entities/physical-order-item.entity';
import { ParcelEntity } from './parcel.entity';
import { DecimalTransformer } from 'src/common/transformers/decimal.transformer';

@Entity()
export class OrderItemEntity implements IOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  orderId: number;

  @Column('int')
  configId: number;

  @Column('boolean', { default: false })
  isChangeUpdatePrice: boolean;

  @Column('int')
  quantity: number;

  @Column('boolean')
  isMarketplace: boolean;

  @Column('decimal', {
    precision: 10,
    scale: 1,
    nullable: true,
    transformer: DecimalTransformer,
  })
  checkoutPurchasePrice: number;

  @Column('int', { nullable: true })
  checkoutPrice: number;

  @Column('int', { nullable: true }) // TODO: remove nullable after DB migration
  checkoutBasePrice: number;

  @Column('int', { nullable: true, default: 0 })
  feeAmount: number;

  @Column('int', { nullable: true })
  tempParcelId: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userid' })
  user: Relation<User>;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderid' })
  order: Relation<OrderEntity>;

  @ManyToOne(() => ParcelEntity, { nullable: true })
  @JoinColumn({ name: 'tempparcelid' })
  tempParcel: Relation<ParcelEntity> | null;

  @ManyToOne(() => CarPartConfigEntity)
  @JoinColumn({ name: 'configid' })
  config: Relation<CarPartConfigEntity>;

  @OneToMany(
    () => PhysicalOrderItemEntity,
    (physicalOrderItem) => physicalOrderItem.orderItem,
  )
  physicalOrderItems: Relation<PhysicalOrderItemEntity[]>;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;
}
