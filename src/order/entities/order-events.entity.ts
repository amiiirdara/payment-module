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
import { User } from '../../users/users.entity';
import { OrderEntity } from './order.entity';
import {
  IOrderEvent,
  OrderEventTypeEnum,
  OrderStateEnum,
  ParcelShippingCourier,
  ParcelStateEnum,
} from 'types/interfaces/order/order.interface';
import { ParcelEntity } from './parcel.entity';

@Index('IDX_order_event_log_order_created', ['orderId', 'createdDate'], {
  where: '"type" = \'LOG\'',
})
@Entity()
export class OrderEventEntity implements IOrderEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  userId: number;

  @Column('int')
  orderId: number;

  @Column('int', { nullable: true })
  parcelId: number;

  @Column('enum', { enum: OrderEventTypeEnum })
  type: OrderEventTypeEnum;

  // delete nulable after DB migration
  @Column('enum', { enum: OrderStateEnum, nullable: true, default: null })
  state: OrderStateEnum;

  @Column('enum', { enum: ParcelStateEnum, nullable: true, default: null })
  parcelState: ParcelStateEnum;

  @Column('varchar', { length: 500, nullable: true, default: null })
  description: string;

  @Column('interval', { nullable: true, default: null })
  durationInState?: string;

  @Column('enum', {
    enum: ParcelShippingCourier,
    nullable: true,
    default: null,
  })
  shippingCourier: ParcelShippingCourier;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userid' })
  user: Relation<User>;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderid' })
  order: Relation<OrderEntity>;

  @ManyToOne(() => ParcelEntity)
  @JoinColumn({ name: 'parcelid' })
  parcel: Relation<ParcelEntity>;
}
