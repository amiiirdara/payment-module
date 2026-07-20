import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Auth } from 'src/auth/auth.decorator';
import { RoleType } from 'src/auth/roles.enum';
import { CarPartService } from 'src/car-part/services/car-part.service';
import { AuthRequest } from 'src/common/interfaces';
import { PaginationQuery } from 'src/common/utils';
import {
  PaymentTransactionState,
  PaymentType,
} from 'types/interfaces/payment/payment.interface';
import {
  AvailableShippigTypeDto,
  AvailableShippigTypeDtoEwano,
  CreateOrderDto,
  SnappPayEligibleDto,
} from './dto/order.dto';
import { OrderService } from './order.service';
import { CreateOrderPickupInStoreDto } from './dto/order-pickup-in-store.dto';
import { AsyncLocalStorage } from 'async_hooks';
import { LoggerService } from 'src/common/logger/logger.service';
import { toError } from 'src/common/error.utils';

@ApiTags('order')
@Controller('order')
export class OrderController {
  constructor(
    public service: OrderService,
    public carPartService: CarPartService,
    private readonly als: AsyncLocalStorage<any>,
    private readonly logger: LoggerService,
  ) {}

  @Get('shipping-types-ewano')
  @Auth(RoleType.normal)
  @ApiBearerAuth()
  async getAvailableShippingTypesEwano(
    @Query() query: AvailableShippigTypeDtoEwano,
    @Req() request: AuthRequest,
  ) {
    return this.service.getUserAvailableShippingCostsEwano(
      request.user.id,
      query.cityId,
      query.provinceId,
    );
  }

  @Get('shipping-types')
  @Auth(RoleType.normal)
  @ApiBearerAuth()
  async getAvailableShippingTypes(
    @Query() query: AvailableShippigTypeDto,
    @Req() request: AuthRequest,
  ) {
    return this.service.getUserAvailableShippingCosts(
      request.user.id,
      query.cityId,
      query.provinceId,
      request.abTestVariants,
    );
  }

  @Get('postClubGroupsTara')
  // @Auth(RoleType.normal)
  @ApiBearerAuth()
  async GetPostClubGroups() {
    return await this.service.GetPostClubGroups();
  }

  @Get('checkTara')
  // @Auth(RoleType.normal)
  @ApiBearerAuth()
  async checkTara(@Query('token') query: string) {
    return await this.service.checkTara(query);
  }

  @Get('checkSnapp')
  // @Auth(RoleType.normal)
  @ApiBearerAuth()
  async checkSnapp(@Query('token') query: string) {
    try {
      const result = await this.service.checkSnapp(query);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Swallowed (translated into a success:false payload) — logger.error
      // is the single Sentry capture (ADR-037 rule 8). Token deliberately
      // NOT logged (secret, rule 6).
      this.logger.error(
        'check_snapp_failed',
        toError(error),
        'OrderController',
        {
          gateway: 'snapp_pay',
          operation: 'status',
        },
      );
      return {
        success: false,
        error: error.message,
        details: error.response?.data || error,
      };
    }
  }

  @Auth(RoleType.normal)
  @ApiBearerAuth()
  @Get()
  async getOrders(@Req() req: AuthRequest, @Query() query: PaginationQuery) {
    return this.service.getOrderList(req.user.id, query.page, query.limit);
  }

  @Get('verify') // it's actually zarinpal-verify
  async test(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.ZARINPAL);
  }

  @Post('snappay-verify')
  async verifySnappPay(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.SNAPP_PAY);
  }

  @Post('torobpay-verify')
  async verifyTorobPay(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.TOROB_PAY);
  }

  @Post('saman-verify')
  async verifySaman(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.SAMAN);
  }

  @Post('tara-verify')
  async verifyTara(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.TARA);
  }

  @Auth(RoleType.normal)
  @Post('/ewano-verify')
  @ApiBearerAuth()
  async ewanoPaymentByWallet(@Req() req: AuthRequest, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.EWANO, req.user.id);
  }

  @Post('/itol-verify')
  async verifyItol(@Req() req: AuthRequest, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.ITOL);
  }

  @Post('digipay-verify')
  async verifyDigiPay(@Req() req: AuthRequest, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.DIGI_PAY);
  }

  @Get('azki-verify')
  async verifyAzki(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.AZKI);
  }

  @Get('zarinplus-verify')
  async verifyZarinPlus(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.ZARINPLUS);
  }

  @Get('keepa-verify')
  async verifyKeepa(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.KEEPA);
  }

  @Get('vibe-verify')
  async verifyVibe(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.VIBE);
  }

  @Post('vibe-refund-status')
  @Auth(RoleType.admin)
  @ApiBearerAuth()
  async getVibeRefundStatus(@Body() body: { orderId: string }) {
    return this.service.getVibeRefundStatus(body.orderId);
  }

  @Get('itol-pay-status/:orderId')
  async getItolPaymentStatus(
    @Param('orderId') orderId: string,
  ): Promise<{ status: PaymentTransactionState; orderId: number }> {
    const id = Number(orderId);
    if (Number.isNaN(orderId)) {
      throw new BadRequestException();
    }
    return this.service.getItolPaymentStatus(id);
  }

  @Get('snapp-pay-eligibility')
  @Auth(RoleType.normal)
  @ApiBearerAuth()
  async checkSnappPayEligibility(
    @Req() request: AuthRequest,
    @Query() query: SnappPayEligibleDto,
  ) {
    const amount = Number(query.amount);
    if (Number.isNaN(amount)) {
      throw new BadRequestException();
    }
    return this.service.checkSnappPayEligibility(amount);
  }

  @Get('torob-pay-eligibility')
  @Auth(RoleType.normal)
  @ApiBearerAuth()
  async checkTorobPayEligibility(
    @Req() request: AuthRequest,
    @Query() query: SnappPayEligibleDto,
  ) {
    const amount = Number(query.amount);
    if (Number.isNaN(amount)) {
      throw new BadRequestException();
    }
    return this.service.checkTorobPayEligibility(amount);
  }

  @Get('verify/:id')
  @Auth(RoleType.normal)
  @ApiBearerAuth()
  async getOrderPaymentStatus(
    @Req() req: AuthRequest,
    @Param('id') idS: string,
  ) {
    const id = Number(idS);
    if (Number.isNaN(id)) {
      throw new BadRequestException();
    }
    return this.service.getOrderPaymentStatus(req.user.id, id);
  }

  @Post()
  @Auth(RoleType.normal)
  @ApiBearerAuth()
  async proceedCheckout(
    @Body() dto: CreateOrderDto,
    @Req() request: AuthRequest,
    @Res() res: Response,
  ) {
    return this.service.proceedCheckout(
      request.user.id,
      dto,
      request.hostname,
      res,
      request.abTestVariants,
    );
  }

  @Post('proceed-checkout-pickup-in-store')
  @Auth(RoleType.normal)
  @ApiBearerAuth()
  async proceedCheckoutPickupInStore(
    @Body() dto: CreateOrderPickupInStoreDto,
    @Req() request: AuthRequest,
  ) {
    return this.service.proceedCheckoutPickupInStore(
      request.user.id,
      dto,
      request.hostname,
    );
  }

  @Get(':id')
  @Auth(RoleType.normal)
  @ApiBearerAuth()
  async getOrder(@Req() request: AuthRequest, @Param('id') idS: string) {
    const id = Number(idS);
    if (Number.isNaN(id)) {
      throw new BadRequestException();
    }
    return this.service.getOrder(request.user.id, id);
  }
}
