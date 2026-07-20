import { User } from 'src/users/users.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { CartStateEnum, ICart } from 'types/interfaces/cart/cart.interface';
import { CartItemEntity } from './cart-item.entity';
import { DomainNameEn } from 'types/enums/domain-name.enum';
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import { InstallationBookingEntity } from 'src/installation/entities/installation-booking.entity';

@Entity()
@Index('IDX_USER_ACTIVE_CART_NO_SUPPLIER', ['userId'], {
  unique: true,
  where: "state = 'ACTIVE' AND instoresupplieruserid IS NULL",
})
@Index('IDX_USER_SUPPLIER_ACTIVE_CART', ['userId', 'inStoreSupplier'], {
  unique: true,
  where: "state = 'ACTIVE' AND instoresupplieruserid IS NOT NULL",
})
export class CartEntity implements ICart {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  userId: number;

  @Column('enum', { enum: CartStateEnum, default: CartStateEnum.ACTIVE })
  state: CartStateEnum;

  @Column('enum', { enum: DomainNameEn, nullable: true }) // TODO: remove nullable after DB migration
  domainNameEn: DomainNameEn;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;

  @OneToMany(() => CartItemEntity, (cartItem) => cartItem.cart)
  items: Relation<CartItemEntity[]>;

  // Installation sub-aggregate — parallel to `items`, lives under the same cart root.
  // See `_design/phase-1-implementation.md` for the architecture rationale.
  @OneToMany(() => InstallationBookingEntity, (booking) => booking.cart)
  installationBookings: Relation<InstallationBookingEntity[]>;

  @ManyToOne(() => User, { cascade: true })
  @JoinColumn({ name: 'userid' })
  user: Relation<User>;

  @Column('boolean', { default: false })
  showUpdatedAlert?: boolean;

  @Column('int', { nullable: true })
  inStoreSupplierUserId: number | null;

  @ManyToOne(() => SupplierEntity, { nullable: true })
  @JoinColumn({
    name: 'instoresupplieruserid',
    referencedColumnName: 'userId',
  })
  inStoreSupplier: Relation<SupplierEntity>;
}
