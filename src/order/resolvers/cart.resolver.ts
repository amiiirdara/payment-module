import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from 'src/decorators/get-current-user.decorator';
import { GQLAuth } from 'src/auth/auth.decorator';
import { JwtDto } from 'src/auth/dto/jwt.dto';
import { CartModel } from '../models/cart.model';
import { CartService } from '../cart.service';

@Resolver(() => CartModel)
@GQLAuth()
export class CartResolver {
  constructor(private service: CartService) {}

  @GQLAuth()
  @Query(() => [CartModel])
  async getCart(@CurrentUser() user: JwtDto) {
    return this.service.getCartItemsGQL(user.id);
  }

  @GQLAuth()
  @Mutation(() => Boolean)
  async addToCart(
    @Args('configId', { type: () => Int }) configId: number,
    @Args('quantity', { type: () => Int }) quantity: number,
    @CurrentUser() user: JwtDto,
  ) {
    await this.service.updateUserCart(user.id, [
      {
        configId,
        quantity,
      },
    ]);
    return true;
  }
}
