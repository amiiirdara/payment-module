import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { IOrder } from 'types/interfaces/order/order.interface';
import { User } from '../../users/users.entity';
import { PaymentEntity } from '../../payments/entities/payment.entity';
import { DiscountEntity } from '../../discount/entities/discount.entity';
import { AddressCloneEntity } from '../../address/entities/address-clone.entity';
import { OrderItemEntity } from './order-item.entity';
import { PaymentType } from 'types/interfaces/payment/payment.interface';
import { DomainNameEn } from 'types/enums/domain-name.enum';
import { OrderEventEntity } from './order-events.entity';
import { OrderCancelDescriptionEntity } from './order-cancel-description.entity';
import { ParcelEntity } from './parcel.entity';
import { ReturnEntity } from 'src/return/entities/return.entity';
import { OrderExperimentEntity } from './order-experiment.entity';
import { InstallationReserveEntity } from 'src/installation/entities/installation-reserve.entity';
import { ManualRefundEntity } from './manual-refund.entity';

@Entity()
export class OrderEntity implements IOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  userId: number;

  @Column('int', { nullable: true })
  paymentId: number;

  @Column('int', { nullable: true })
  discountId: number;

  @Column({ nullable: true, default: null })
  postOfficeBarcode: string;

  @Column('enum', { enum: PaymentType, nullable: true }) // TODO: remove nullable after DB migration
  paymentType: PaymentType;

  @Column('enum', { enum: DomainNameEn, nullable: true }) // TODO: remove nullable after DB migration
  domainNameEn: DomainNameEn;

  @Column('int', { nullable: true })
  addressCloneId: number;

  @Column('int', { nullable: true }) // TODO: remove nullable after DB migration
  totalPrice: number;

  @Column('boolean', { default: false })
  redirectToOrg: boolean;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;

  @ManyToOne(() => User, { cascade: true })
  @JoinColumn({ name: 'userid' })
  user: Relation<User>;

  @OneToOne(() => AddressCloneEntity)
  @JoinColumn({ name: 'addresscloneid' })
  addressClone: Relation<AddressCloneEntity>;

  @ManyToOne(() => PaymentEntity, { cascade: true })
  @JoinColumn({ name: 'paymentid' })
  payment: Relation<PaymentEntity>;

  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.order)
  items: OrderItemEntity[];

  @OneToMany(() => ParcelEntity, (parcel) => parcel.order)
  parcels: ParcelEntity[];

  @OneToMany(() => OrderEventEntity, (orderEvent) => orderEvent.order)
  events: OrderEventEntity[];

  @ManyToOne(() => DiscountEntity, { cascade: true })
  @JoinColumn({ name: 'discountid' })
  discount: Relation<DiscountEntity>;

  @OneToOne(
    () => OrderCancelDescriptionEntity,
    (cancellation) => cancellation.order,
  )
  cancellation: OrderCancelDescriptionEntity;

  @OneToMany(() => ReturnEntity, (returnEntity) => returnEntity.order)
  returns: ReturnEntity[];

  @Column('decimal', { precision: 10, scale: 2, nullable: true }) // TODO: remove nullable after DB migration
  discountAmount: number;

  @Column({ nullable: true, default: true })
  utm: string;

  @OneToOne(
    () => OrderExperimentEntity,
    (orderExperiment) => orderExperiment.order,
  )
  experiment: Relation<OrderExperimentEntity>;

  // Installation sub-aggregate — parallel to `parcels`, lives under the same
  // order root (Q13 / OI-4 option 1). An order may have 0..N reserves
  // independent of how many parcels it has (goods-only, install-only, or both).
  @OneToMany(() => InstallationReserveEntity, (reserve) => reserve.order)
  installationReserves: Relation<InstallationReserveEntity[]>;

  // Manual refund obligations on this order (gateways with no auto refund, e.g.
  // SAMAN, or partial refunds on non-partial gateways). Support deposits these
  // to the user's sheba out of band.
  @OneToMany(() => ManualRefundEntity, (refund) => refund.order)
  manualRefunds: Relation<ManualRefundEntity[]>;
}
