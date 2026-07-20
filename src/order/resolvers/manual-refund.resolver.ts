import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GQLAuth } from 'src/auth/auth.decorator';
import { JwtDto } from 'src/auth/dto/jwt.dto';
import { CurrentUser } from 'src/decorators/get-current-user.decorator';

import { ManualRefundService } from '../services/manual-refund.service';
import { ManualRefundStateEnum } from 'src/types/interfaces/order/manual-refund.interface';
import {
  ManualRefundModel,
  PaginatedManualRefundsModel,
} from '../models/manual-refund.model';

/**
 * Admin-facing GraphQL resolver for manual refund obligations.
 *
 * Gating: `@GQLAuth()` with no `@Roles` is admin-only (GQLRoleGuard passes
 * admins, rejects everyone else) — same idiom as InstallationReserveAdminResolver
 * / OrderResolver.adminCancelOrder.
 */
@Resolver(() => ManualRefundModel)
@GQLAuth()
export class ManualRefundResolver {
  constructor(private readonly service: ManualRefundService) {}

  @Query(() => PaginatedManualRefundsModel, {
    description:
      'Admin: list manual refund obligations (generalTable). Filters on state, ' +
      'orderId, userId; newest first; enriched with user name/phone/current sheba.',
  })
  async adminManualRefunds(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('state', { type: () => [ManualRefundStateEnum], nullable: true })
    state?: ManualRefundStateEnum[],
    @Args('orderId', { type: () => Int, nullable: true }) orderId?: number,
    @Args('userId', { type: () => Int, nullable: true }) userId?: number,
  ): Promise<PaginatedManualRefundsModel> {
    return this.service.adminList({
      state: state ?? undefined,
      orderId: orderId ?? undefined,
      userId: userId ?? undefined,
      page,
      limit,
    });
  }

  @Mutation(() => Boolean, {
    description:
      'Admin marks a manual refund REFUNDED (deposit done). Records the negative ' +
      'PaymentTransaction with the user sheba snapshot + refundedBy/refundedAt. ' +
      'Allowed only from PENDING_REFUND. Returns true on success.',
  })
  async adminMarkManualRefundRefunded(
    @CurrentUser() user: JwtDto,
    @Args('id', { type: () => Int }) id: number,
    @Args('description', { type: () => String, nullable: true })
    description?: string,
  ): Promise<boolean> {
    await this.service.markRefunded(id, user.id, description);
    return true;
  }

  @Mutation(() => Boolean, {
    description:
      'Admin flags a manual refund as blocked on a bad/missing IBAN ' +
      '(PENDING_REFUND → NEED_TO_USERS_CORRECT_SHEBA). Returns true on success.',
  })
  async adminMarkManualRefundNeedCorrectSheba(
    @Args('id', { type: () => Int }) id: number,
    @Args('description', { type: () => String, nullable: true })
    description?: string,
  ): Promise<boolean> {
    await this.service.markNeedCorrectSheba(id, description);
    return true;
  }

  @Mutation(() => Boolean, {
    description:
      'Admin reverts a sheba-blocked manual refund back to depositable ' +
      '(NEED_TO_USERS_CORRECT_SHEBA → PENDING_REFUND). Returns true on success.',
  })
  async adminRevertManualRefundToPending(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    await this.service.revertToPending(id);
    return true;
  }
}
