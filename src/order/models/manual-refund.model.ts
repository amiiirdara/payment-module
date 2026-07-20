import { Field, Int, ObjectType } from '@nestjs/graphql';

import { ManualRefundStateEnum } from 'src/types/interfaces/order/manual-refund.interface';
import { PaymentType } from 'src/types/interfaces/payment/payment.interface';

/**
 * Admin-panel view of a manual refund obligation.
 *
 * The `user*` fields are enriched server-side (batch-loaded in
 * ManualRefundService.adminList) so support can see who to pay and to which
 * sheba — `userCurrentSheba` is the user's CURRENT IBAN (live), distinct from
 * the snapshot stored on the negative PaymentTransaction at REFUNDED time. If it
 * is null/empty the admin should move the row to NEED_TO_USERS_CORRECT_SHEBA.
 */
@ObjectType()
export class ManualRefundModel {
  @Field(() => Int) id: number;
  @Field(() => Int) orderId: number;
  @Field(() => Int) userId: number;
  @Field(() => Int) amount: number;
  @Field(() => String, { nullable: true }) description: string | null;
  @Field(() => PaymentType, { nullable: true })
  paymentGateway: PaymentType | null;
  @Field(() => ManualRefundStateEnum) state: ManualRefundStateEnum;
  @Field(() => Int, { nullable: true }) refundedByUserId: number | null;
  @Field(() => Date, { nullable: true }) refundedAt: Date | null;
  @Field(() => Date) createDate: Date;
  @Field(() => Date) updateDate: Date;

  // ─── Enriched user info (for the deposit panel) ───
  @Field(() => String, { nullable: true }) userFullName: string | null;
  @Field(() => String, { nullable: true }) userPhoneNumber: string | null;
  @Field(() => String, { nullable: true }) userCurrentSheba: string | null;
}

@ObjectType()
export class PaginatedManualRefundsModel {
  @Field(() => [ManualRefundModel]) items: ManualRefundModel[];
  @Field(() => Int) total: number;
}
