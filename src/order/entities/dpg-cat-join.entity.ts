import { CarPartCategoryEntity } from 'src/car-part-category/car-part-category.entity';
import { DomainPaymentGatewayEntity } from 'src/payment-gateway/entities/domain-payment-gateway.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Unique(['domainPaymentGatewayId', 'categoryId'])
export class DomainPaymentGatewayCatJoinEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => DomainPaymentGatewayEntity,
    (domainGateway) => domainGateway.categoryJoins,
  )
  @JoinColumn({ name: 'domainpaymentgatewayid' })
  domainPaymentGateway: Relation<DomainPaymentGatewayEntity>;

  @Column('int')
  domainPaymentGatewayId: number;

  @ManyToOne(() => CarPartCategoryEntity, (object) => object.id)
  @JoinColumn({ name: 'categoryid' })
  category: Relation<CarPartCategoryEntity>;

  @Column('int')
  categoryId: number;

  @Column('int', { default: 0 })
  feePercent: number;

  @CreateDateColumn()
  createDate: string;

  @UpdateDateColumn()
  updateDate: string;
}
