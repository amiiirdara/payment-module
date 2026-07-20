import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
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
import { CarPartSize } from 'types/interfaces';
import {
  ParcelShippingCourier,
  ShippingDurationEnum,
  ShippingType,
} from 'types/interfaces/order/order.interface';

@Entity()
export class OrderShippingEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  title: string;

  @Column('int', { nullable: true })
  cityId: number;

  @Column('int', { nullable: true })
  provinceId: number;

  @Column('enum', { enum: ShippingType })
  shippingType: ShippingType;

  @Column('int')
  price: number;

  @Column('int', { default: 0 })
  packingCost: number;

  @Column('enum', { enum: CarPartSize, nullable: true })
  size: CarPartSize;

  @Column('enum', {
    enum: ShippingDurationEnum,
    default: ShippingDurationEnum.WORKING_DAYS_2_OR_4,
  })
  shippingDuration: ShippingDurationEnum;

  @Column('enum', {
    enum: ParcelShippingCourier,
    nullable: true,
    default: null,
  })
  courier: ParcelShippingCourier | null;

  @Index('IDX_order_shipping_supplier')
  @Column('int', { nullable: true })
  supplierUserId: number | null;

  @ManyToOne(() => SupplierEntity, { nullable: true })
  @JoinColumn({ name: 'supplieruserid', referencedColumnName: 'userId' })
  supplier: Relation<SupplierEntity>;

  @CreateDateColumn()
  createDate: Date;

  @UpdateDateColumn()
  updateDate: Date;
}
