import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/auth/auth.decorator';
import { RoleType } from 'src/auth/roles.enum';
import { AddToCartDto, MergeShoppingCartDto } from './dto/cart.dto';
import { CartService } from './cart.service';
import { AuthRequest } from 'src/common/interfaces';
import { CartItemsResponseDto } from './dto/cart-items-response.dto';

@ApiTags('cart')
@Auth(RoleType.normal)
@ApiBearerAuth()
@Controller('cart')
export class ShoppingCartController {
  constructor(private readonly service: CartService) {}

  @Get('alert')
  async getCartUpdatedAlert(@Request() request: AuthRequest) {
    return this.service.getCartUpdatedAlert(request.user.id);
  }

  @Get('check-goverment-tire')
  async checkGovermentTire(
    @Request() request: AuthRequest,
    @Query('number') number: number,
  ) {
    return this.service.checkGovermentTire(request.user.id, Number(number));
  }

  @Get()
  @ApiOkResponse({ type: CartItemsResponseDto })
  async getCartItems(
    @Request() request: AuthRequest,
    @Query('supplierUserId') supplierUserId?: string,
  ): Promise<CartItemsResponseDto> {
    const inStoreSupplierUserIdNumber = supplierUserId
      ? Number(supplierUserId)
      : undefined;
    return this.service.getCartItems(
      request.user.id,
      request.abTestVariants,
      inStoreSupplierUserIdNumber,
    );
  }

  @Post()
  async updateCart(@Request() request: AuthRequest, @Body() dto: AddToCartDto) {
    if (!request.user.id) {
      throw new ForbiddenException();
    }
    return this.service.updateUserCart(
      request.user.id,
      dto.items,
      dto.inStoreSupplierUserId,
    );
  }

  @Delete(':id')
  async deleteConfigIdFromCart(
    @Request() request: AuthRequest,
    @Param('id') id: string,
    @Query('supplierUserId') supplierUserId?: string,
  ) {
    const inStoreSupplierUserIdNumber = supplierUserId
      ? Number(supplierUserId)
      : undefined;
    const idNumber = Number(id);
    if (Number.isNaN(idNumber)) {
      throw new BadRequestException('invalid-id');
    }
    try {
      await this.service.updateUserCart(
        request.user.id,
        [
          {
            configId: idNumber,
            quantity: 0,
          },
        ],
        inStoreSupplierUserIdNumber,
      );
      return 'deleted';
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  @Get('cross-sale')
  async getCrossSale(@Request() request: AuthRequest) {
    return this.service.getCrossSalePartsForUser(request.user.id);
  }

  @Post('merge-cart')
  async mergeLocalCart(
    @Request() request: AuthRequest,
    @Body() dto: MergeShoppingCartDto,
  ) {
    if (!request.user.id) {
      throw new ForbiddenException();
    }
    return this.service.mergeCarts(
      request.user.id,
      dto.localCart,
      dto.localInstallationBookings,
    );
  }

  @Patch('deactivate-cart')
  async deactivateCart(@Request() request: AuthRequest) {
    if (!request.user.id) {
      throw new ForbiddenException();
    }
    return this.service.deactivateCart(request.user.id);
  }
}
