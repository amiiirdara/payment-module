import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CartItemModel } from './cart-item.model';
import { CartStateEnum, ICart } from 'types/interfaces/cart/cart.interface';
import { Relation } from 'typeorm';
import { DomainNameEn } from 'types/enums/domain-name.enum';
import { UserModel } from '../../users/models/user.model';
import { SupplierModel } from 'src/supplier/models/supplier.model';

@ObjectType()
export class CartModel implements ICart {
  @Field(() => Int)
  id: number;

  @Field(() => Int)
  userId: number;

  @Field(() => String)
  state: CartStateEnum;

  @Field(() => String, { nullable: true })
  domainNameEn: DomainNameEn;

  @Field(() => Date)
  createdDate: Date;

  @Field(() => Date)
  updatedDate: Date;

  @Field(() => UserModel)
  user: Relation<UserModel>;

  @Field(() => [CartItemModel])
  items: Relation<CartItemModel>[];

  @Field(() => Boolean, { nullable: true })
  showUpdatedAlert?: boolean;

  @Field(() => Int, { nullable: true })
  inStoreSupplierUserId: number | null;

  @Field(() => SupplierModel, { nullable: true })
  inStoreSupplier: Relation<SupplierModel>;
}
