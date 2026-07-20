import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { FieldRole } from '../../access-control/access-control.middleware';
import { RoleType } from '../../auth/roles.enum';

@ObjectType()
export class OrderStatsModel {
  @Field(() => Int)
  @FieldRole(RoleType.seller)
  totalOrders: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  totalOrdersSupplied: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  totalOrdersSupplying: number;

  @Field(() => Float)
  @FieldRole(RoleType.seller)
  sumOfAllTotalPrices: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  totalOrdersCancelled: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  totalConfigNumbersAvailable: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  totalConfigNumbers: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  totalConfigNumbersDisabledOrContactUs: number;

  @Field(() => Int)
  @FieldRole(RoleType.seller)
  totalConfigNumbersCapacityZero: number;
}
