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
import {
  FreeShippingReason,
  IParcel,
  ParcelDeliveryMethod,
  ParcelShippingCourier,
  ParcelStateEnum,
  ShippingDurationEnum,
  ShippingType,
} from 'types/interfaces/order/order.interface';
import { OrderEntity } from './order.entity';
import { PhysicalOrderItemEntity } from 'src/physical-item/entities/physical-order-item.entity';
import { OrderItemEntity } from './order-item.entity';
import { OrderEventEntity } from './order-events.entity';
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import { ShippingEntity } from 'src/shipping/entities/shipping.entity';
import { CarPartSize } from 'types/interfaces';

@Entity()
export class ParcelEntity implements IParcel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('enum', {
    enum: ParcelStateEnum,
    default: ParcelStateEnum.INITIAL,
  })
  state: ParcelStateEnum;

  @Column('enum', { enum: ShippingType, default: ShippingType.ECONOMY })
  shippingType: ShippingType;

  @Column('enum', { enum: CarPartSize, default: CarPartSize.TIRE })
  size: CarPartSize;

  @Column('integer', { nullable: true }) // TODO: remove nullable after DB migration
  shippingCost: number;

  @Column('integer', { nullable: true, default: null })
  baseShippingCost: number;

  @Column('integer', { default: 0 })
  packingCost: number;

  @Column({
    type: 'enum',
    enum: FreeShippingReason,
    nullable: true,
    default: null,
  })
  freeShippingReason: FreeShippingReason;

  @Column('enum', {
    enum: ParcelShippingCourier,
    nullable: true,
    default: null,
  })
  courier: ParcelShippingCourier | null;

  @Column('enum', {
    enum: ShippingDurationEnum,
    default: ShippingDurationEnum.WORKING_DAYS_2_OR_4,
  })
  shippingDuration: ShippingDurationEnum; // change this to shippingDuration after migration

  @Column('enum', {
    default: ParcelDeliveryMethod.AUTOMOBY,
    enum: ParcelDeliveryMethod,
  })
  parcelDeliveryMethod: ParcelDeliveryMethod;

  @Column('timestamptz', { nullable: true, default: null })
  collectDeadline: Date;

  @Column('timestamptz', { nullable: true, default: null })
  prepDeadline: Date;

  @Column({ type: 'boolean', default: false })
  isExpressShipping: boolean;

  @Column('timestamptz', { nullable: true, default: null })
  deliveryDeadline: Date;

  @Column('int', { nullable: true, default: null })
  shippingSupplierUserId: number | null;

  @Column({ type: 'boolean', default: false })
  isShippingCostRefunded: boolean;

  @Column('int')
  orderId: number;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderid' })
  order: Relation<OrderEntity>;

  @OneToMany(
    () => PhysicalOrderItemEntity,
    (physicalOrderItem) => physicalOrderItem.parcel,
  )
  physicalOrderItems: Relation<PhysicalOrderItemEntity[]>;

  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.tempParcel)
  tempItems: OrderItemEntity[];

  @OneToMany(() => OrderEventEntity, (event) => event.parcel)
  events: Relation<OrderEventEntity[]>;

  @OneToMany(() => ShippingEntity, (shipping) => shipping.parcel)
  shipping: Relation<ShippingEntity[]> | null;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;

  @Column('int', { nullable: true })
  inStoreSupplierUserId: number | null;

  @ManyToOne(() => SupplierEntity, { nullable: true })
  @JoinColumn({ name: 'instoresupplieruserid', referencedColumnName: 'userId' })
  inStoreSupplier: Relation<SupplierEntity> | null;

  getDeadline(): Date {
    return this.parcelDeliveryMethod === ParcelDeliveryMethod.SELLER
      ? this.prepDeadline
      : this.collectDeadline;
  }
}
