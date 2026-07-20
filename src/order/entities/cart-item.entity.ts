import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { CarPartConfigEntity } from 'src/car-part/entities/car-part-config.entity';
import { ICartItem } from 'types/interfaces/cart/cart.interface';
import { CartEntity } from './cart.entity';

@Entity()
export class CartItemEntity implements ICartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  cartId: number;

  @Column('int')
  configId: number;

  @Column('int')
  quantity: number;

  @Column('boolean')
  isMarketplace: boolean;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;

  @ManyToOne(() => CartEntity, { cascade: true })
  @JoinColumn({ name: 'cartid' })
  cart: Relation<CartEntity>;

  @ManyToOne(() => CarPartConfigEntity)
  @JoinColumn({ name: 'configid' })
  config: Relation<CarPartConfigEntity>;
}
