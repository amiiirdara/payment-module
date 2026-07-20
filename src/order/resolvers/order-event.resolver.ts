import {
  Args,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { OrderEventModel } from '../models/order-event.model';
import { GQLAuth } from 'src/auth/auth.decorator';
import { OrderService } from '../order.service';
import { UserLoader } from 'src/users/loaders/users.loader';
import { OrderLoader } from '../loaders/order.loader';
import { CurrentUser } from 'src/decorators/get-current-user.decorator';
import { JwtDto } from 'src/auth/dto/jwt.dto';
import { OrderEventDto } from '../dto/order-event.dto';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { UserModel } from 'src/users/models/user.model';
import { OrderModel } from '../models/order.model';

@Resolver(() => OrderEventModel)
@GQLAuth()
export class OrderEventResolver {
  constructor(
    private service: OrderService,
    private userLoader: UserLoader,
    private orderLoader: OrderLoader,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @ResolveField('user', () => UserModel, { nullable: true })
  async getUser(@Parent() OrderEventModel: OrderEventModel) {
    if (OrderEventModel.userId)
      return this.userLoader.getUserById.load(OrderEventModel.userId);
    return null;
  }
  @ResolveField('oreder', () => OrderModel, { nullable: true })
  async getOrder(@Parent() OrderEventModel: OrderEventModel) {
    if (OrderEventModel.orderId)
      return this.orderLoader.getOrderById.load(OrderEventModel.orderId);
    // getUserById.load(OrderEventModel.userId);
    return null;
  }

  @Query(() => [OrderEventModel])
  async getOrderEventsByOrderId(@Args('id', { type: () => Int }) id: number) {
    return this.service.getOrderEventsByOrderId(id);
  }

  @Query(() => [OrderEventModel])
  async getOrderEventsByParcelId(@Args('id', { type: () => Int }) id: number) {
    return this.service.getOrderEventsByParcelId(id);
  }

  @Mutation(() => Boolean)
  async addCommentOrderEvent(
    @Args('data') input: OrderEventDto,
    @CurrentUser() user: JwtDto,
  ): Promise<boolean> {
    return this.service.addCommentOrderToOrder(
      input.description,
      user.id,
      input.orderId,
      input.parcelId,
    );
  }
}
