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
import { User } from '../../users/users.entity';
import { OrderEntity } from './order.entity';
import { IOrderGovermentTiresEntity } from 'types/interfaces/order/order.interface';
import { CarPartEntity } from 'src/car-part/entities/car-part.entity';

@Entity()
export class OrderGovermentTiresEntity implements IOrderGovermentTiresEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column('int')
  userId: number;

  @Column('int')
  carPartId: number;

  @Column('int')
  orderId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userid' })
  user: Relation<User>;

  @ManyToOne(() => CarPartEntity)
  @JoinColumn({ name: 'carpartid' })
  carPart: Relation<CarPartEntity>;

  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'orderid' })
  order: Relation<OrderEntity>;

  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;
}
