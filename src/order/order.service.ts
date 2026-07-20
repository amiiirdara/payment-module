import {
  BadRequestException,
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { Request, Response } from 'express';
import { AddressEntity } from 'src/address/entities/address.entity';
import { CarPartService } from 'src/car-part/services/car-part.service';
import { getQueryBuilder } from 'src/common/gql/filter-helper/filter.decorator';
import { SamanPayment } from 'src/common/payment/saman.util';
import {
  SnappPay,
  SnappPayStatusResponse,
} from 'src/common/payment/snapp-pay.util';
import {
  SnappPayCommissionType,
  getSnappPayCommissionType,
} from 'src/common/payment/snapp-pay-commission';
import { Zarinpal } from 'src/common/payment/zarinpal.util';
import { Utils, WrapperType, GetManyDefaultResponse } from 'src/common/utils';
import { DiscountService } from 'src/discount/discount.service';
import { UsersService } from 'src/users/users.service';
import { CampaignService } from 'src/campaign/campaign.service';
import { ReserveCheckoutService } from 'src/installation/services/reserve/reserve-checkout.service';
import { ReserveQueryService } from 'src/installation/services/reserve/reserve-query.service';
import { ReserveLifecycleService } from 'src/installation/services/reserve/reserve-lifecycle.service';
import { InstallationBookingEntity } from 'src/installation/entities/installation-booking.entity';
import { InstallationReserveCancelReasonEnum } from 'src/types/interfaces/installation/installation-reserve.interface';
import {
  Between,
  DataSource,
  EntityManager,
  In,
  Not,
  QueryRunner,
  Repository,
  LessThanOrEqual,
  MoreThan,
  IsNull,
  FindOptionsWhere,
  FindOptionsOrder,
} from 'typeorm';
import { CarPartSize } from 'types/interfaces';
import {
  DeliveryMethod,
  SBSPrepTimeEnum,
  SellerCollectPeriod,
  StockAction,
} from 'types/interfaces/car-part/car-part-config.interface';
import { CartStateEnum, ICartItem } from 'types/interfaces/cart/cart.interface';
import {
  DiscountType,
  IDiscount,
} from 'types/interfaces/discount/discount.interface';
import {
  IOrder,
  IOrderItem,
  IParcel,
  OrderEventTypeEnum,
  OrderStateTimeFilterEnum,
  ParcelStateEnum,
  ParcelShippingCourier,
  ParcelShippingListCityEnum,
  ParcelAvailableShippingType,
  ParcelWithShippingType,
  ShippingDurationEnum,
  FreeShippingReason,
  ShippingType,
  ParcelDeliveryMethod,
  PickupInStoreFilterStateEnum,
} from 'types/interfaces/order/order.interface';
import {
  PaymentTransactionState,
  PaymentType,
} from 'types/interfaces/payment/payment.interface';
import { IUser } from 'types/interfaces/user/user.interface';
import { v4 as uuidv4 } from 'uuid';
import { AddressCloneEntity } from '../address/entities/address-clone.entity';
import { CarPartConfigEntity } from '../car-part/entities/car-part-config.entity';
import { EwanoUtil } from '../common/payment/ewano.util';
import { DiscountEntity } from '../discount/entities/discount.entity';
import { EwanoService } from '../ewano/ewano.service';
import { PaymentTransactionEntity } from '../payments/entities/payment-transaciont.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { PaymentService } from '../payments/payment.service';
import { SearchService } from '../search/search.service';
import {
  AdminCancelOrderCallDigiPayInput,
  CancelOrderInput,
  CreateOrderDto,
  GetSellerOrders,
  OrderFilter,
  transactionIdInput,
  OrderQuery,
  ParcelFilter,
  parcelInput,
  ParcelQuery,
  ParcelShippingDto,
  ShippingListInput,
  SnappPayUpdateDto,
  TaraPartialRefundDto,
  GetPickupInStoreParcelsInput,
} from './dto/order.dto';
import { CartItemEntity } from './entities/cart-item.entity';
import { CartEntity } from './entities/cart.entity';
import { OrderEventEntity } from './entities/order-events.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderShippingEntity } from './entities/order-shipping.entity';
import { OrderEntity } from './entities/order.entity';
import { OrderExperimentEntity } from './entities/order-experiment.entity';
import { FilterLogicOperator } from 'types/enums/filter.enum';
import { domainMap, DomainNameEn } from 'types/enums/domain-name.enum';
import { TaraPayment, TaraIpgPurchaseData } from 'src/common/payment/tara.util';
import { AsyncLocalStorage } from 'async_hooks';
import { TakhfifanService } from 'src/takhfifan/takhfifan.service';
import { TakhfifanPaymentService } from 'src/takhfifan/takhfifan-payment.service';
import { CITY, CITY_Id, SPECIAL_CATEGORY_ID } from 'types/enums/automoby.enum';
import * as Sentry from '@sentry/nestjs';
import { PhysicalItemService } from 'src/physical-item/services/physical-item.service';
import { OrderCancelDescriptionEntity } from './entities/order-cancel-description.entity';
import { OrderGovermentTiresEntity } from './entities/order-goverment-tires.entity';
import { ProcessCapacityService } from 'src/process-capacity/process-capacity.service';
import { SupplierCalendarService } from 'src/supplier-calendar/supplier-calendar.service';

import {
  SellerParcelsGetOrderBy,
  SupplyStateEnum,
} from 'types/interfaces/supply/supply.interface';
import { PhysicalOrderItemEntity } from 'src/physical-item/entities/physical-order-item.entity';

import { SMSService } from 'src/common/providers/sms/sms.service';
import { SMSTypes } from 'types/enums/sms-types.enum';
import { TorobPay } from 'src/common/payment/torob-pay.util';
import { ParcelEntity } from './entities/parcel.entity';
import { ParcelChangeStateService } from './services/parcel-change-state.service';
import { RefundService } from './services/refund.service';
import { OrderUtils } from './utils';
import { CartService } from './cart.service';
import { SupplierDeliveryType } from 'types/interfaces/supplier/supplier.interface';
import { ParcelService } from './services/parcel.service';
import { PaginatedShippingList } from './models/parcel.model';
import { CreateItolOrderData, ItolUtil } from 'src/common/payment/itol.util';
import { ItolService } from 'src/itol/itol.service';
import { DigipayService } from 'src/digipay/digipay.service';
import { CreateOrderData } from 'src/digipay/digipay.interface';
import { KeepaService } from 'src/keepa/keepa.service';
import { PaymentStatus } from 'src/keepa/keepa.interface';
import { VibeService } from 'src/vibe/vibe.service';
import { AzkiService } from 'src/azki/azki.service';
import { AzkiTicketStatus } from 'src/azki/azki.interface';
import { JwtDto } from 'src/auth/dto/jwt.dto';
import { RoleService } from 'src/role/role.service';
import { SupplierService } from 'src/supplier/supplier.service';
import { addDays, differenceInCalendarDays } from 'date-fns-jalali';
import { AddressService } from 'src/address/address.service';
import { Utm } from 'src/users/users.entity';
import {
  AbTestVariants,
  isMapStrategyConfig,
} from 'src/ab-test/interfaces/ab-test.interface';
import { AbTestService } from 'src/ab-test/ab-test.service';
import { PaymentGatewayEntity } from 'src/payment-gateway/entities/payment-gateway.entity';
import { PaymentMethod } from 'types/enums/payment-method.enum';
import { CreateOrderPickupInStoreDto } from './dto/order-pickup-in-store.dto';
import { DomainPaymentGatewayEntity } from 'src/payment-gateway/entities/domain-payment-gateway.entity';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { DomainPaymentGatewayCatJoinEntity } from './entities/dpg-cat-join.entity';
import { ServiceService } from 'src/service/service.service';
import { SnappBoxService } from 'src/snapp-box/snapp-box.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { toError } from 'src/common/error.utils';
import { ZarinPlusService } from 'src/zarinplus/zarinplus.service';
import {
  checkoutFunnelTotal,
  gatewayCallbackUnpaidTotal,
  verifyOrderGatewaySuccessTotal,
  verifyOrderSuccessTotal,
} from 'src/common/metrics';
import { getCurrentDomain } from 'src/common/metrics-domain';
import { MessagingService } from 'src/common/providers/messaging/messaging.service';

@Injectable()
export class OrderService {
  public payment: Zarinpal;
  public ewano: EwanoUtil;

  private readonly MINIMUM_AMOUNT_FOR_FREE_SHIPPING =
    process.env.MINIMUM_AMOUNT_FOR_FREE_SHIPPING;
  private readonly ONLINE_SHIPPING_DISCOUNT_PERCENT = Number(
    process.env.ONLINE_SHIPPING_DISCOUNT_PERCENT || 0,
  );
  private readonly SNAPPBOX_ENABLED = process.env.SNAPPBOX_ENABLED !== 'false';

  private async getShippingDiscountPercent(
    paymentType: PaymentType,
  ): Promise<number> {
    const gateway = await this.paymentGatewayRepo.findOne({
      where: { paymentType },
      select: { paymentMethod: true },
    });

    if (gateway?.paymentMethod === PaymentMethod.ONLINE) {
      return this.ONLINE_SHIPPING_DISCOUNT_PERCENT;
    }
    return 0;
  }

  private calculateDiscountedShippingCost(
    basePrice: number,
    discountPercent: number,
  ): number {
    if (discountPercent <= 0) return basePrice;
    return Math.max(0, Math.round((basePrice * (100 - discountPercent)) / 100));
  }

  /**
   * Same as getPaymentGatewayFeeByPaymentType but returns join row id per category
   * so AB test markup can override feePercent by DomainPaymentGatewayCatJoinEntity id.
   */
  public async getPaymentGatewayFeeWithJoinIds(
    categoryIds: number[],
    paymentType: PaymentType,
    domainNameEn: DomainNameEn,
  ): Promise<Map<number, { feePercent: number; dpgCatJoinId: number }>> {
    if (!categoryIds || categoryIds.length === 0) {
      return new Map();
    }

    const dpgId = await this.getDpgIdFromPaymentType(paymentType, domainNameEn);
    if (!dpgId) {
      return new Map();
    }

    const results = await this.DPGCatJoinRepo.find({
      where: {
        domainPaymentGatewayId: dpgId,
        categoryId: In(categoryIds),
      },
      select: {
        id: true,
        categoryId: true,
        feePercent: true,
      },
    });

    const feeMapWithJoinIds = new Map<
      number,
      { feePercent: number; dpgCatJoinId: number }
    >();
    for (const result of results) {
      feeMapWithJoinIds.set(result.categoryId, {
        feePercent: result.feePercent,
        dpgCatJoinId: result.id,
      });
    }

    return feeMapWithJoinIds;
  }

  public calculateItemFee(
    itemPrice: number,
    quantity: number,
    feePercent: number,
    hasFeeCategory: boolean,
  ): number {
    // TODO: give these parameters to front not logic for prevent bugs
    if (!hasFeeCategory || feePercent <= 0) return 0;
    return Utils.roundPrice((itemPrice * feePercent) / 100, 3);
  }

  /**
   * Checks if an item has a fee category based on DPGCatJoinEntity table.
   * An item has fee if its categoryId exists in the feeMap (which comes from DPGCatJoinEntity).
   * @param item - The cart item to check
   * @param feeMap - Map of categoryId to feePercent from DPGCatJoinEntity
   * @returns true if the item's category exists in DPGCatJoinEntity, false otherwise
   */
  public hasFeeCategory(
    item: CartItemEntity | ICartItem,
    feeMap: Map<number, number>,
  ): boolean {
    const categoryIds = Utils.extractCarPartCategoryIds(item);

    // Check if any of the item's categories exist in the feeMap (DPGCatJoinEntity)
    return categoryIds.some((categoryId) => feeMap.has(categoryId));
  }

  public calculateOrderTotalFeeAmount(
    orderItems: Pick<IOrderItem, 'feeAmount' | 'quantity'>[],
  ): number {
    return orderItems.reduce(
      (total, item) => total + (item.feeAmount || 0) * item.quantity,
      0,
    );
  }

  public getItemFeePercent(
    item: CartItemEntity | ICartItem,
    feeMap: Map<number, number>,
  ): number {
    const categoryIds = Utils.extractCarPartCategoryIds(item);

    // Find the first category that has a fee in the map
    for (const categoryId of categoryIds) {
      const feePercent = feeMap.get(categoryId);
      if (feePercent !== undefined) {
        return feePercent;
      }
    }

    return 0;
  }

  /**
   * Returns base feePercent, dpgCatJoinId and categoryId for an item from fee map with join ids.
   * Used when applying AB test markup override.
   */
  public getItemFeePercentAndJoinId(
    item: CartItemEntity | ICartItem,
    feeMapWithJoinIds: Map<
      number,
      { feePercent: number; dpgCatJoinId: number }
    >,
  ): {
    feePercent: number;
    dpgCatJoinId: number | undefined;
    categoryId: number | undefined;
  } {
    const categoryIds = Utils.extractCarPartCategoryIds(item);

    for (const categoryId of categoryIds) {
      const entry = feeMapWithJoinIds.get(categoryId);
      if (entry !== undefined) {
        return {
          feePercent: entry.feePercent,
          dpgCatJoinId: entry.dpgCatJoinId,
          categoryId,
        };
      }
    }

    return { feePercent: 0, dpgCatJoinId: undefined, categoryId: undefined };
  }

  public async getDpgIdFromPaymentType(
    paymentType: PaymentType,
    domainNameEn: DomainNameEn,
  ): Promise<number> {
    const domainGateway = await this.domainGatewayRepo.findOne({
      where: {
        domainName: domainNameEn,
        gateway: { paymentType },
      },
      relations: ['gateway'],
    });

    return domainGateway?.id || 0;
  }

  constructor(
    private readonly logger: LoggerService,
    private readonly als: AsyncLocalStorage<any>,
    private readonly saman: SamanPayment,
    private readonly tara: TaraPayment,
    private readonly snapp: SnappPay,
    private readonly torob: TorobPay,
    private readonly itol: ItolUtil,
    private readonly digipayService: DigipayService,
    private readonly keepaService: KeepaService,
    private readonly vibeService: VibeService,
    private readonly azkiService: AzkiService,
    private readonly zarinPlusService: ZarinPlusService,

    @InjectRepository(OrderEntity)
    private readonly repo: Repository<OrderEntity>,

    @InjectRepository(OrderGovermentTiresEntity)
    private readonly orderGovermentTireRepo: Repository<OrderGovermentTiresEntity>,

    @InjectRepository(OrderEventEntity)
    private readonly orderEventRepo: Repository<OrderEventEntity>,

    @InjectRepository(ParcelEntity)
    private readonly parcelRepo: Repository<ParcelEntity>,

    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: Repository<OrderItemEntity>,

    @InjectRepository(CartEntity)
    private readonly cartRepo: Repository<CartEntity>,

    @InjectRepository(OrderShippingEntity)
    private readonly orderShippingRepo: Repository<OrderShippingEntity>,

    @InjectRepository(OrderCancelDescriptionEntity)
    private readonly orderCancellationRepo: Repository<OrderCancelDescriptionEntity>,

    @InjectRepository(PhysicalOrderItemEntity)
    private readonly physicalOrderItemRepo: Repository<PhysicalOrderItemEntity>,

    @InjectRepository(PaymentGatewayEntity)
    private readonly paymentGatewayRepo: Repository<PaymentGatewayEntity>,

    @InjectRepository(DomainPaymentGatewayCatJoinEntity)
    private readonly DPGCatJoinRepo: Repository<DomainPaymentGatewayCatJoinEntity>,

    @Inject(forwardRef(() => DiscountService))
    private readonly discountService: WrapperType<DiscountService>,

    @Inject(forwardRef(() => CarPartService))
    private readonly carPartService: WrapperType<CarPartService>,

    private readonly searchService: SearchService,

    @Inject(forwardRef(() => PaymentGatewayService))
    private readonly paymentGatewayService: WrapperType<PaymentGatewayService>,

    @Inject(forwardRef(() => UsersService))
    private readonly userService: WrapperType<UsersService>,

    private readonly paymentService: PaymentService,
    private readonly ewanoService: EwanoService,
    private readonly itolService: ItolService,
    private readonly takhfifanService: TakhfifanService,
    private readonly takhfifanPaymentService: TakhfifanPaymentService,
    private readonly roleService: RoleService,

    @Inject(forwardRef(() => PhysicalItemService))
    private readonly physicalItemService: WrapperType<PhysicalItemService>,

    private readonly processCapacityService: ProcessCapacityService,
    private readonly supplierCalendarService: SupplierCalendarService,

    @InjectDataSource()
    private readonly dataSource: DataSource,

    private readonly smsService: SMSService,

    @Inject(forwardRef(() => CartService))
    private readonly cartService: WrapperType<CartService>,

    private readonly parcelChangeStateService: ParcelChangeStateService,
    @Inject(forwardRef(() => ParcelService))
    private readonly parcelService: WrapperType<ParcelService>,
    private readonly supplierService: SupplierService,

    @Inject(forwardRef(() => AddressService))
    private readonly addressService: WrapperType<AddressService>,

    private readonly abTestService: AbTestService,

    @Inject(forwardRef(() => CampaignService))
    private readonly campaignService: WrapperType<CampaignService>,

    @InjectRepository(DomainPaymentGatewayEntity)
    private readonly domainGatewayRepo: Repository<DomainPaymentGatewayEntity>,

    @Inject(forwardRef(() => ServiceService))
    private readonly serviceService: ServiceService,

    @Inject(forwardRef(() => SnappBoxService))
    private readonly snappBoxService: WrapperType<SnappBoxService>,

    // The installation reserve service was split by concern (checkout / query /
    // lifecycle); OrderService touches all three. forwardRef + WrapperType on each
    // because OrderService ↔ the checkout/lifecycle services form a cycle.
    @Inject(forwardRef(() => ReserveCheckoutService))
    private readonly installationCheckoutService: WrapperType<ReserveCheckoutService>,
    @Inject(forwardRef(() => ReserveQueryService))
    private readonly installationReserveQueryService: WrapperType<ReserveQueryService>,
    @Inject(forwardRef(() => ReserveLifecycleService))
    private readonly installationLifecycleService: WrapperType<ReserveLifecycleService>,

    // RefundService is a leaf (injects gateways directly, NOT OrderService), so
    // no forwardRef is needed — it owns all gateway refund dispatch.
    private readonly refundService: RefundService,
    private readonly messagingService: MessagingService,
  ) {
    this.payment = new Zarinpal(logger);

    this.ewano = new EwanoUtil(logger);
  }

  async GetPostClubGroups() {
    const postClubGroups = await this.tara.postClubGroups();
    this.logger.log('tara work purchaseInquiryResult', 'OrderService', {
      postClubGroups,
    });
    return postClubGroups;
  }

  async checkTara(query: string) {
    const purchaseInquiryResult = await this.tara.purchaseInquiry(query);
    this.logger.log('tara work purchaseInquiryResult', 'OrderService', {
      purchaseInquiryResult,
    });
    return purchaseInquiryResult;
  }

  async checkSnapp(query: string): Promise<SnappPayStatusResponse> {
    const purchaseInquiryResult = await this.snapp.statusBackOffice(query);
    this.logger.log('snapp work purchaseInquiryResult', 'OrderService', {
      purchaseInquiryResult,
    });
    return purchaseInquiryResult;
  }

  async checkTorob(query: string): Promise<SnappPayStatusResponse> {
    const purchaseInquiryResult = await this.torob.status(query);
    this.logger.log('torob work purchaseInquiryResult', 'OrderService', {
      purchaseInquiryResult,
    });
    return purchaseInquiryResult;
  }

  public async updateSnappay(dto: SnappPayUpdateDto) {
    const { amount, paymentToken, cartList, discountAmount } = dto;
    try {
      await this.snapp.update(amount, paymentToken, cartList, discountAmount);
      return true;
    } catch (e) {
      // Translated to a 4xx below, so the exception filter will NOT
      // error-capture it — this logger.error is the single Sentry capture
      // for the underlying gateway failure (ADR-037 rule 8).
      this.logger.error('snapp_update_failed', toError(e), 'OrderService', {
        gateway: 'snapp_pay',
        operation: 'update',
        amount,
      });
      throw new BadRequestException(e.message);
    }
  }
  public async updateTorobpay(dto: SnappPayUpdateDto) {
    const { amount, paymentToken, cartList, discountAmount } = dto;
    try {
      await this.torob.update(amount, paymentToken, cartList, discountAmount);
      return true;
    } catch (e) {
      // Translated to a 4xx below — this is the single Sentry capture.
      this.logger.error('torob_update_failed', toError(e), 'OrderService', {
        gateway: 'torob_pay',
        operation: 'update',
        amount,
      });
      throw new BadRequestException(e.message);
    }
  }

  public async partialRefundTara(dto: TaraPartialRefundDto) {
    const { amount, referenceNumber, orderItem } = dto;
    try {
      await this.tara.partialRefund(referenceNumber, orderItem, amount);
      return true;
    } catch (e) {
      // Translated to a 4xx below — this is the single Sentry capture.
      this.logger.error(
        'tara_partial_refund_failed',
        toError(e),
        'OrderService',
        {
          gateway: 'tara',
          operation: 'refund',
          referenceNumber,
          amount,
        },
      );
      throw new BadRequestException(e.message);
    }
  }

  async checkSnappPayEligibility(amount: number) {
    //TODO: does it need to check maount with db totalPrice?
    const res = await this.snapp.checkEligibility(amount * 10);
    // const res = {
    //   eligible: true,
    //   title_message: 'پرداخت قسطی با اسنپ‌پی',
    //   description: `۴ قسط بدون کارمزد، ماهانه ${amount / 4} تومان`,
    // };
    return res;
  }

  async checkTorobPayEligibility(amount: number) {
    //TODO: does it need to check maount with db totalPrice?
    const res = await this.torob.checkEligibility(amount * 10);
    // const res = {
    //   eligible: true,
    //   title_message: 'پرداخت قسطی با ترب پی',
    //   description: `۴ قسط بدون کارمزد، ماهانه ${amount / 4} تومان`,
    // };
    return res;
  }

  //TODO Parcel: Coming soon recode
  // async getOrderStats(
  //   userId: number,
  //   timeRange?: OrderStatisticsTimeRanges,
  // ): Promise<OrderStatsModel> {
  //   let timeFilter = {};
  //   const now: Date = new Date();
  //   if (timeRange) {
  //     switch (timeRange) {
  //       case OrderStatisticsTimeRanges.TODAY:
  //         timeFilter = {
  //           createdDate: Between(startOfDay(new Date()), endOfDay(new Date())),
  //         };
  //         break;
  //       case OrderStatisticsTimeRanges.LAST_WEEK:
  //         const sevenDaysAgo = subDays(now, 7);

  //         timeFilter = {
  //           createdDate: Between(startOfDay(sevenDaysAgo), endOfDay(now)),
  //         };
  //         break;
  //       case OrderStatisticsTimeRanges.LAST_2_WEEKS:
  //         const fourteenDaysAgo = subDays(now, 14);

  //         timeFilter = {
  //           createdDate: Between(startOfDay(fourteenDaysAgo), endOfDay(now)),
  //         };
  //         break;
  //       case OrderStatisticsTimeRanges.LAST_MONTH:
  //         const thirtyDaysAgo = subDays(now, 30);

  //         timeFilter = {
  //           createdDate: Between(startOfDay(thirtyDaysAgo), endOfDay(now)),
  //         };
  //         break;
  //       case OrderStatisticsTimeRanges.FROM_START_OF_MONTH:
  //         const startOfMonthDate = startOfMonth(new Date());
  //         timeFilter = {
  //           createdDate: Between(startOfMonthDate, endOfDay(new Date())),
  //         };
  //         break;
  //       case OrderStatisticsTimeRanges.LAST_3_MONTH:
  //         const ninetyDaysAgo = subDays(now, 90);

  //         timeFilter = {
  //           createdDate: Between(startOfDay(ninetyDaysAgo), endOfDay(now)),
  //         };
  //         break;
  //       default:
  //         timeFilter = {};
  //         break;
  //     }
  //   }

  //   const totalOrders = await this.repo.count({
  //     where: {
  //       items: {
  //         config: {
  //           supplierUserId: userId,
  //         },
  //       },
  //       ...timeFilter,
  //     },
  //   });

  //   const totalOrdersSupplied = await this.repo.count({
  //     where: {
  //       items: {
  //         config: {
  //           supplierUserId: userId,
  //         },
  //       },
  //       state: OrderStateEnum.WAITING_FOR_PACKING,
  //       ...timeFilter,
  //     },
  //   });

  //   const totalOrdersSupplying = await this.repo.count({
  //     where: {
  //       items: {
  //         config: {
  //           supplierUserId: userId,
  //         },
  //       },
  //       state: OrderStateEnum.WAITING_FOR_SUPPLIER,
  //       ...timeFilter,
  //     },
  //   });

  //   const orders = await this.repo.find({
  //     where: {
  //       items: {
  //         config: {
  //           supplierUserId: userId,
  //         },
  //         ...timeFilter,
  //       },
  //     },
  //   });

  //   const sumOfAllTotalPrices = orders.reduce(
  //     (acc, order) => acc + order.totalPrice,
  //     0,
  //   );

  //   const totalOrdersCancelled = await this.repo.count({
  //     where: {
  //       items: {
  //         config: {
  //           supplierUserId: userId,
  //         },
  //       },
  //       state: OrderStateEnum.SUPPLIER_REJECTED,
  //       ...timeFilter,
  //     },
  //   });

  //   const totalConfigNumbersAvailable =
  //     await this.carPartService.getTotalConfigNumbersAvailable(userId);

  //   const totalConfigNumbers = await this.carPartService.getTotalConfigNumbers(
  //     userId,
  //   );
  //   const totalConfigNumbersDisabledOrContactUs =
  //     await this.carPartService.getTotalConfigNumbersDisabledOrContactUs(
  //       userId,
  //     );
  //   const totalConfigNumbersCapacityZero =
  //     await this.carPartService.getTotalConfigNumbersSellerStockZero(userId);

  //   return {
  //     totalOrders,
  //     totalOrdersSupplied,
  //     totalOrdersSupplying,
  //     sumOfAllTotalPrices,
  //     totalOrdersCancelled,
  //     totalConfigNumbersAvailable,
  //     totalConfigNumbers,
  //     totalConfigNumbersDisabledOrContactUs,
  //     totalConfigNumbersCapacityZero,
  //   };
  // }

  //TODO Parcel: Needs review
  async getOrders(query: OrderQuery, userId?: number) {
    const fts = query.fullTextSearch;
    let elasticIds;
    let elasticCount;
    let elasticFrom;
    let elasticLimit;
    if (fts) {
      const { resultIds, count, from, limit } =
        await this.searchService.searchOrdersInElastic({
          ...query,
          q: query.fullTextSearch,
          page: query.pagination.page,
          limit: query.pagination.limit,
        });
      elasticIds = resultIds.map((id) => parseInt(id, 10));
      elasticCount = count;
      elasticFrom = from;
      elasticLimit = limit;
    }
    let where: any = getQueryBuilder(
      query.filter,
      query.filterLogicOperator,
      OrderFilter.name,
    );
    where = fts ? { ...where, id: In(elasticIds) } : where;
    if (userId) {
      if (query.filterLogicOperator === FilterLogicOperator.OR) {
        where = where.map((w) => ({
          ...w,
          items: {
            config: {
              supplierUserId: userId,
            },
          },
        }));
      } else {
        where = {
          ...where,
          items: {
            config: {
              supplierUserId: userId,
            },
          },
        };
      }
    }
    const [items, total] = await this.repo.findAndCount({
      where: where,
      relations: ['events'],
      take: query.pagination.limit,
      skip: query.pagination.page * query.pagination.limit,
      order:
        query.sort && Object.keys(query.sort).length > 0
          ? query.sort
          : {
              id: 'DESC',
            },
    });
    return Utils.createPageInfo(
      items,
      fts ? elasticCount : total,
      fts ? elasticLimit : query.pagination.limit,
      fts ? elasticFrom : query.pagination.limit * query.pagination.page,
    );
  }

  async sellerParcelsGet(query: GetSellerOrders, userId: number) {
    const fts = query.fullTextSearch;
    let elasticIds;
    if (fts) {
      const { resultIds } =
        await this.searchService.searchSellerParcelsInElastic(
          {
            q: query.fullTextSearch,
            page: query.page,
            limit: query.limit,
          },
          userId,
        );
      elasticIds = resultIds.map((id) => parseInt(id, 10));
    }
    const {
      dueDate,
      limit,
      page,
      supplyState,
      stateTime,
      isDisplayingWithoutBillOfLading,
      parcelStates,
      shipBySeller,
      OrderBy: OrderByEnum,
    } = query;
    let delayedItems: boolean | number = false;
    let conditionMet = false;

    if (dueDate && supplyState) {
      throw new BadRequestException(
        'Invalid query: You cannot filter by both dueDate and state simultaneously. Please provide only one of them.',
      );
    }

    let OrderBy: FindOptionsOrder<ParcelEntity>;

    if (OrderByEnum === SellerParcelsGetOrderBy.UPDATE_DATE_DESC) {
      OrderBy = {
        updatedDate: 'DESC',
      };
    } else if (OrderByEnum === SellerParcelsGetOrderBy.PARCEL_ID_DESC) {
      OrderBy = {
        id: 'DESC',
      };
    } else {
      OrderBy = {
        prepDeadline: 'ASC',
        collectDeadline: 'ASC',
      };
    }

    const whereDefault:
      | FindOptionsWhere<ParcelEntity>
      | FindOptionsWhere<ParcelEntity>[] = {
      physicalOrderItems: {
        physicalItem: {
          config: {
            supplierUserId: userId,
          },
        },
      },
      state: Not(ParcelStateEnum.PAYMENT_PENDING),
    };

    let where: FindOptionsWhere<ParcelEntity>;

    if (shipBySeller) {
      where = {
        ...whereDefault,
        parcelDeliveryMethod: ParcelDeliveryMethod.SELLER,
        state:
          parcelStates && parcelStates.length > 0
            ? In(parcelStates)
            : undefined,
        physicalOrderItems: {
          physicalItem: {
            config: {
              supplierUserId: userId,
            },
          },

          parcel: {
            shipping: {
              billOfLading: isDisplayingWithoutBillOfLading
                ? IsNull()
                : undefined,
            },
          },
        },
      };
    } else {
      if (stateTime) {
        if (stateTime === OrderStateTimeFilterEnum.OLD && dueDate) {
          delayedItems = true;
          (where = {
            ...whereDefault,
            collectDeadline: LessThanOrEqual(dueDate),
            parcelDeliveryMethod: ParcelDeliveryMethod.AUTOMOBY,
            physicalOrderItems: {
              physicalItem: {
                config: {
                  supplierUserId: userId,
                },
                supplies: {
                  state: SupplyStateEnum.WAITING_FOR_PURCHASE,
                },
              },
            },
          }),
            (conditionMet = true);
        } else if (stateTime === OrderStateTimeFilterEnum.NEW && dueDate) {
          (where = {
            ...whereDefault,
            collectDeadline: MoreThan(dueDate),
            parcelDeliveryMethod: ParcelDeliveryMethod.AUTOMOBY,
            physicalOrderItems: {
              physicalItem: {
                config: {
                  supplierUserId: userId,
                },
                supplies: {
                  state: SupplyStateEnum.WAITING_FOR_PURCHASE,
                },
              },
            },
          }),
            (conditionMet = true);
        } else if (stateTime === OrderStateTimeFilterEnum.ALL && !dueDate) {
          (where = {
            ...whereDefault,
            parcelDeliveryMethod: ParcelDeliveryMethod.AUTOMOBY,
            physicalOrderItems: {
              physicalItem: {
                config: {
                  supplierUserId: userId,
                },
                supplies: {
                  state: SupplyStateEnum.WAITING_FOR_PURCHASE,
                },
              },
            },
          }),
            (conditionMet = true);
        }
        if (!conditionMet) {
          throw new Error('No valid stateTime condition met');
        }
      } else {
        where = {
          ...whereDefault,
          parcelDeliveryMethod: ParcelDeliveryMethod.AUTOMOBY,
          physicalOrderItems: {
            physicalItem: {
              config: {
                supplierUserId: userId,
              },
              supplies: {
                state: supplyState ? supplyState : undefined,
              },
            },
          },
        };
      }
    }

    where = fts ? { ...where, id: In(elasticIds) } : where;
    const [items, total] = await this.parcelRepo.findAndCount({
      where,
      order: OrderBy,
      relations: {
        physicalOrderItems: { physicalItem: { supplies: true, config: true } },
      },
      take: limit,
      skip: page * limit,
    });

    const PaginatedOrder = Utils.createPageInfo(
      items,
      total,
      limit,
      page * limit,
    );

    if (!delayedItems) {
      delayedItems = await this.parcelRepo.count({
        where: {
          state: Not(ParcelStateEnum.PAYMENT_PENDING),
          collectDeadline: LessThanOrEqual(dueDate),
          parcelDeliveryMethod: ParcelDeliveryMethod.AUTOMOBY,
          physicalOrderItems: {
            physicalItem: {
              supplies: {
                state: SupplyStateEnum.WAITING_FOR_PURCHASE,
              },
            },
          },
          order: {
            items: {
              config: {
                supplierUserId: userId,
              },
            },
          },
        },
      });
    }

    delayedItems = typeof delayedItems === 'number' ? delayedItems : total;

    return {
      ...PaginatedOrder,
      delayedItems,
    };
  }

  async getParcels(query: ParcelQuery) {
    const fts = query.fullTextSearch;
    let elasticIds: number[] = [];
    let elasticCount;
    let elasticFrom;
    let elasticLimit;
    if (fts) {
      const { resultIds, count, from, limit } =
        await this.searchService.searchParcelsInElastic({
          ...query,
          q: query.fullTextSearch,
          page: query.pagination.page,
          limit: query.pagination.limit,
        });
      elasticIds = resultIds.map((id) => parseInt(id, 10));
      elasticCount = count;
      elasticFrom = from;
      elasticLimit = limit;
      if (elasticIds.length === 0) {
        return Utils.createPageInfo(
          [],
          elasticCount,
          elasticLimit,
          elasticFrom,
        );
      }
    }
    let where: any = getQueryBuilder(
      query.filter,
      query.filterLogicOperator,
      ParcelFilter.name,
    );
    if (fts) {
      where = Array.isArray(where)
        ? where.map((w) => ({ ...w, id: In(elasticIds) }))
        : { ...where, id: In(elasticIds) };
    }
    const [items, total] = await this.parcelRepo.findAndCount({
      where: where,
      relations: { events: true },
      take: query.pagination.limit,
      skip: fts ? 0 : query.pagination.page * query.pagination.limit,
      order:
        query.sort && Object.keys(query.sort).length > 0
          ? query.sort
          : {
              id: 'DESC',
            },
    });
    const orderedItems = fts
      ? [...items].sort(
          (a, b) => elasticIds.indexOf(a.id) - elasticIds.indexOf(b.id),
        )
      : items;
    return Utils.createPageInfo(
      orderedItems,
      fts ? elasticCount : total,
      fts ? elasticLimit : query.pagination.limit,
      fts ? elasticFrom : query.pagination.limit * query.pagination.page,
    );
  }

  async pickupInStoreParcelsGet(
    query: GetPickupInStoreParcelsInput,
    params:
      | { isAdmin: true; supplierUserId: undefined }
      | { isAdmin: false; supplierUserId: number },
  ): Promise<GetManyDefaultResponse<ParcelEntity>> {
    const { filter, fullTextSearch, pagination } = query;
    const parcelState = filter?.state;
    const search = fullTextSearch;
    const page = pagination?.page ?? 0;
    const limit = pagination?.limit ?? 10;

    const { isAdmin, supplierUserId } = params;

    const {
      resultIds,
      count,
      from,
      limit: elasticLimitValue,
    } = await this.searchService.searchParcelsInElastic(
      {
        q: search,
        page: page + 1, // Elastic search uses 1-based page
        limit,
      },
      supplierUserId,
      true, // onlyPickupInStore
    );
    const elasticIds = resultIds.map((id) => parseInt(id, 10));
    const elasticCount = count;
    const elasticFrom = from;
    const elasticLimit = elasticLimitValue;

    let stateFilter: ParcelStateEnum[];

    if (
      parcelState === PickupInStoreFilterStateEnum.PICKUP_IN_STORE_DELIVERED
    ) {
      stateFilter = [ParcelStateEnum.PICKUP_IN_STORE_DELIVERED];
    } else if (parcelState === PickupInStoreFilterStateEnum.CANCELLED) {
      stateFilter = [
        ParcelStateEnum.CANCELLED_ADMIN,
        ParcelStateEnum.CANCELLED_SYSTEM,
      ];
    } else {
      stateFilter = [
        ParcelStateEnum.PICKUP_IN_STORE_DELIVERED,
        ParcelStateEnum.CANCELLED_ADMIN,
        ParcelStateEnum.CANCELLED_SYSTEM,
      ];
    }

    const where: any = {};

    if (!isAdmin) {
      where.inStoreSupplierUserId = supplierUserId;
    }

    if (stateFilter) {
      where.state = In(stateFilter);
    }

    if (elasticIds) {
      where.id = In(elasticIds);
    }

    const [items, total] = await this.parcelRepo.findAndCount({
      where,
      order: {
        id: 'DESC',
      },
      take: limit,
      skip: page * limit,
    });

    return Utils.createPageInfo(
      items,
      elasticCount !== undefined ? elasticCount : total,
      elasticLimit !== undefined ? elasticLimit : limit,
      elasticFrom !== undefined ? elasticFrom : page * limit,
    );
  }

  async pickupInStoreParcelGet(
    parcelId: number,
    supplierUserId: number,
  ): Promise<ParcelEntity> {
    const parcel = await this.parcelRepo.findOne({
      where: { id: parcelId },
      relations: {
        order: {
          addressClone: true,
          items: { config: { carPart: true, supplier: true } },
          user: true,
        },
        physicalOrderItems: true,
      },
    });

    if (!parcel) {
      throw new BadRequestException('پارسل مورد نظر پیدا نشد');
    }

    if (parcel.inStoreSupplierUserId !== supplierUserId) {
      throw new BadRequestException('شما اجازه دسترسی به این پارسل را ندارید');
    }

    return parcel;
  }

  async getOrderItemById(ids: readonly number[]) {
    return this.orderItemRepo.find({ where: { id: In([-1, ...ids]) } });
  }

  async getOrderItemsByConfigId(configId: number) {
    return this.orderItemRepo.find({
      where: { configId },
    });
  }

  async getOrderItemsByParcelIds(ids: readonly number[]) {
    return await this.orderItemRepo.find({
      where: { tempParcelId: In([-1, ...ids]) },
    });
  }

  //TODO Parcel: Needs review
  async getReadyToShipParcels(query: ShippingListInput) {
    const { pagination, city } = query;
    let orderCity;
    if (city === ParcelShippingListCityEnum.TEHRAN) {
      orderCity = CITY.TEHRAN;
    } else if (city === ParcelShippingListCityEnum.ALL) {
      orderCity = undefined;
    } else if (city === ParcelShippingListCityEnum.OTHER) {
      orderCity = Not(CITY.TEHRAN);
    } else {
      throw new BadRequestException('invalid-city');
    }
    const [tehranTotal, otherTotal, [items, total]] = await Promise.all([
      this.parcelRepo.count({
        where: {
          state: ParcelStateEnum.WAITING_FOR_PACKING,
          order: {
            addressClone: {
              city: CITY.TEHRAN,
            },
          },
        },
        relations: ['addressClone'],
      }),
      this.parcelRepo.count({
        where: {
          state: ParcelStateEnum.WAITING_FOR_PACKING,
          order: {
            addressClone: {
              city: Not(CITY.TEHRAN),
            },
          },
        },
        relations: ['addressClone'],
      }),
      this.parcelRepo.findAndCount({
        where: {
          state: ParcelStateEnum.WAITING_FOR_PACKING,
          order: {
            addressClone: {
              city: orderCity,
            },
          },
        },
        relations: ['addressClone'],
        take: pagination.limit,
        skip: pagination.page * pagination.limit,
        order: {
          id: 'DESC',
        },
      }),
    ]);
    return {
      ...Utils.createPageInfo(
        items,
        total,
        pagination.limit,
        pagination.page * pagination.limit,
      ),
      tehranTotal,
      otherTotal,
      allTotal: tehranTotal + otherTotal,
    } as PaginatedShippingList;
  }

  public async getOrderById(orderId: number): Promise<OrderEntity> {
    const order = await this.repo.findOne({
      where: {
        id: orderId,
      },
      relations: { addressClone: true, items: true, user: true },
    });
    return order;
  }

  public async getOrderByParcelId(parcelId: number): Promise<OrderEntity> {
    const order = await this.repo.findOne({
      where: {
        parcels: { id: parcelId },
      },
      relations: { addressClone: true, items: true, user: true, parcels: true },
    });
    return order;
  }

  async getOrder(userId: number, orderId: number) {
    const order = await this.repo.findOne({
      where: {
        id: orderId,
        userId,
      },
      relations: {
        parcels: {
          shipping: true,
          tempItems: {
            config: {
              carPart: { images: true },
              supplier: true,
            },
          },
          physicalOrderItems: {
            physicalItem: { supplies: true },
          },
        },
        addressClone: true,
        user: true,
      },
      select: {
        id: true,
        createdDate: true,
        totalPrice: true,
        paymentType: true,
        user: {
          id: true,
          phoneNumber: true,
        },
        addressClone: {
          id: true,
          receiverFirstName: true,
          receiverFamilyName: true,
          description: true,
          city: true,
          plaque: true,
          province: true,
          unit: true,
          title: true,
        },
        parcels: {
          id: true,
          state: true,
          shippingCost: true,
          baseShippingCost: true,
          packingCost: true,
          shippingDuration: true,
          prepDeadline: true,
          collectDeadline: true,
          parcelDeliveryMethod: true,
          deliveryDeadline: true,
          isExpressShipping: true,
          shipping: {
            id: true,
            billOfLading: true,
            createdDate: true,
          },
          tempItems: {
            id: true,
            checkoutBasePrice: true,
            checkoutPrice: true,
            quantity: true,
            feeAmount: true,
            config: {
              id: true,
              carPart: {
                id: true,
                name: true,
                images: {
                  id: true,
                  image: true,
                  order: true,
                },
              },
              supplier: {
                id: true,
                title: true,
              },
            },
          },
          physicalOrderItems: {
            id: true,
            physicalItem: {
              id: true,
              supplies: { id: true, state: true },
              state: true,
              configId: true,
            },
          },
        },
      },
      order: {
        parcels: {
          shipping: { createdDate: 'DESC' },
          physicalOrderItems: {
            physicalItem: { supplies: { id: 'DESC' } },
          },
          tempItems: {
            config: {
              carPart: { images: { order: 'ASC' } },
            },
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException(
        'invalid-order or order-is-not-owned-by-you',
      );
    }

    const totalFee = order.parcels.reduce(
      (acc, parcel) =>
        acc +
        (parcel.tempItems?.reduce(
          (sum, item) => sum + (Number(item.feeAmount) || 0),
          0,
        ) ?? 0),
      0,
    );

    const result = {
      ...order,
      state: order.parcels.length ? this.calculateGoodsState(order) : null,
      totalFee,
      totalShippingCost: order.parcels.reduce(
        (acc, parcel) => acc + parcel.shippingCost,
        0,
      ),
      parcels: order.parcels.map((parcel) => {
        let deliveryText = '';
        if (parcel.deliveryDeadline) {
          deliveryText = this.getDeliveryDayText(
            parcel.deliveryDeadline,
            parcel.isExpressShipping || false,
          );
        }
        const totalParcelPrice = parcel.tempItems.reduce(
          (acc, item) => acc + item.checkoutPrice * item.quantity,
          0,
        );
        // shipping is a @OneToMany ordered by createdDate DESC, so [0] is the
        // parcel's latest shipping.
        const shipping = parcel.shipping?.[0] ?? null;

        return {
          ...parcel,
          deliveryText,
          totalParcelPrice,
          shipping,
        };
      }),
    };

    return result;
  }

  /**
   * GOODS-axis state only (derived from order.parcels). Renamed from
   * calculateOrderState — with the two-axis order model it is NOT the whole
   * order's state; it feeds the `goodsState` field. The installation axis
   * (`installState`) is derived separately from the reserves.
   */
  calculateGoodsState(order: OrderEntity): string {
    const stateMeaningShipped = [
      ParcelStateEnum.DELIVERED,
      ParcelStateEnum.SELLER_DELIVERED,
    ];
    const stateMeaningCancel = [
      ParcelStateEnum.CANCELLED_ADMIN,
      ParcelStateEnum.CANCELLED_SYSTEM,
    ];
    const stateShipped = order.parcels.every((parcel) =>
      stateMeaningShipped.includes(parcel.state),
    );
    const stateCancled = order.parcels.every((parcel) =>
      stateMeaningCancel.includes(parcel.state),
    );

    const statePickedUpInStore = order.parcels.every(
      (parcel) => parcel.state === ParcelStateEnum.PICKUP_IN_STORE_DELIVERED,
    );

    return stateShipped
      ? 'ارسال شد'
      : stateCancled
      ? 'لغو شده'
      : statePickedUpInStore
      ? 'تحویل داده شد (حضوری)'
      : 'درحال پردازش';
  }

  async getOrderList(userId: number, page: number, limit: number) {
    // Step 1 — paginate the IDs of orders that should appear in history.
    // An order qualifies if it has at least one non-payment-pending parcel. We
    // do this without joinAndSelect so skip/take pagination counts distinct
    // orders correctly, then hydrate in step 2. The subquery uses `.from(Entity)`
    // so TypeORM resolves the real table name under this project's naming strategy.
    // NB: alias is `ord`, not `order` — `order` is a reserved SQL word and the
    // raw subquery fragment below references it unquoted, which would be a
    // syntax error.
    const idQb = this.repo
      .createQueryBuilder('ord')
      .where('ord.userId = :userId', { userId })
      .andWhere((qb) => {
        const parcelSub = qb
          .subQuery()
          .select('1')
          .from(ParcelEntity, 'p')
          .where('p.orderId = ord.id')
          .andWhere('p.state != :paymentPendingParcel')
          .getQuery();
        return `EXISTS ${parcelSub}`;
      })
      .setParameters({
        paymentPendingParcel: ParcelStateEnum.PAYMENT_PENDING,
      })
      .orderBy('ord.createdDate', 'DESC')
      .skip(page * limit)
      .take(limit);

    const [pagedOrders, count] = await idQb.getManyAndCount();
    const ids = pagedOrders.map((o) => o.id);

    if (ids.length === 0) {
      return { data: [], count: 0, total: count, page, pageCount: limit };
    }

    // Step 2 — hydrate the page with goods relations (kept identical to before).
    const orders = await this.repo.find({
      where: { id: In(ids) },
      select: {
        id: true,
        parcels: {
          state: true,
        },
        items: {
          id: true,
          config: {
            id: true,
            carPart: {
              id: true,
              images: {
                id: true,
                image: true,
                order: true,
              },
            },
          },
        },
        createdDate: true,
        totalPrice: true,
      },
      relations: {
        parcels: true,
        items: { config: { carPart: { images: true } } },
      },
      order: {
        createdDate: 'DESC',
        items: {
          config: {
            carPart: { images: { order: 'ASC' } },
          },
        },
      },
    });

    const data = orders.map((order) => this.buildOrderListItem(order));

    return { data, count: data.length, total: count, page, pageCount: limit };
  }

  /**
   * Project one hydrated order into its order-LIST item: the goods state and the
   * carPart thumbnails. Used by `getOrderList`.
   */
  private buildOrderListItem(order: OrderEntity) {
    const state = order.parcels.length ? this.calculateGoodsState(order) : null;
    const images = order.items
      .map((item) => item.config?.carPart?.images?.[0]?.image)
      .filter((image): image is string => image != null);

    return {
      id: order.id,
      state,
      images,
      createDate: order.createdDate,
      totalPrice: order.totalPrice,
    };
  }

  async getOrderPaymentStatus(userId: number, orderId: number) {
    const order = await this.repo.findOne({
      where: {
        id: orderId,
        userId,
      },
      relations: {
        parcels: true,
        items: {
          config: {
            carPart: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('invalid-order');
    }

    const payment = await this.paymentService.getPaymentById(order.paymentId);
    if (!order) {
      throw new BadRequestException('invalid-payment-id');
    }
    const orderPaymentTransaction = payment.transactions[0];

    return {
      id: order.id,
      parcels: order.parcels,
      paymentStatus: orderPaymentTransaction.state,
      totalPrice: order.totalPrice,
      PaymentType: order.paymentType,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.config.carPart.name,
        price: item.checkoutPrice,
        quantity: item.quantity,
      })),
    };
  }

  async getItolPaymentStatus(
    orderId: number,
  ): Promise<{ status: PaymentTransactionState; orderId: number }> {
    const order = await this.repo.findOne({
      where: {
        id: orderId,
        paymentType: PaymentType.ITOL,
      },
      relations: {
        payment: { transactions: true },
      },
      order: {
        payment: {
          transactions: {
            id: 'ASC', //important !!
          },
        },
      },
      select: {
        id: true,
        payment: {
          id: true,
          transactions: {
            id: true,
            state: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('invalid-order');
    }

    const orderPaymentTransaction = order.payment.transactions[0];

    return { status: orderPaymentTransaction.state, orderId: orderId };
  }

  highestPeriod(
    order:
      | OrderEntity
      | CartEntity
      | { items: CartItemEntity[] }
      | { items: OrderItemEntity[] },
    isShipBySeller: boolean,
  ) {
    const items = Array.isArray(order) ? order : order.items;

    if (isShipBySeller) {
      const highestPrepTime = items.reduce((maxPeriod, item) => {
        const currentPeriod = item.config.prepTime;
        return this.getPeriodLength(currentPeriod) >
          this.getPeriodLength(maxPeriod)
          ? currentPeriod
          : maxPeriod;
      }, SBSPrepTimeEnum.UNDER0HOURS);

      return highestPrepTime;
    } else {
      const highestCollectPeriod = items.reduce((maxPeriod, item) => {
        const currentPeriod = item.isMarketplace
          ? item.config.collectPeriod
          : Utils.amaniCollectPeriod; //its because of Amani
        return this.getPeriodLength(currentPeriod) >
          this.getPeriodLength(maxPeriod)
          ? currentPeriod
          : maxPeriod;
      }, SellerCollectPeriod.UNDER0HOURS);

      return highestCollectPeriod;
    }
  }

  getDomainNameFaFromOrder(order: OrderEntity) {
    const domainNameEn = order.domainNameEn;
    const domainNameFa = domainMap[domainNameEn];
    return domainNameFa;
  }

  async sendPaymentSuccessSms(order: OrderEntity) {
    try {
      if (order.domainNameEn === DomainNameEn.EN_EWANO) {
        return null;
      }

      const foundScrap = order.items.some(
        (item) => item.config.isScrap === true,
      );

      const brand = this.getDomainNameFaFromOrder(order);

      if (foundScrap) {
        await this.smsService.sendSMS(
          SMSTypes.ORDER_WITH_SCRAP,
          order?.user?.phoneNumber,
          {
            brand,
          },
          this.messagingService.getSMSSenderNumber(brand),
        );
      }

      const link =
        order.domainNameEn === DomainNameEn.EN_PARTIFA
          ? 'atmb.ir/hm'
          : 'atmb.ir/hh';

      if (order.domainNameEn === DomainNameEn.EN_PARTIFA) {
        const brand = this.getDomainNameFaFromOrder(order);
        await this.smsService.sendSMS(
          SMSTypes.ORDER_VERIFY_PARTIFA,
          order?.user?.phoneNumber,
          {
            brand,
            fname: order?.user?.firstName,
            lname: order?.user?.lastName,
            link,
            orderId: order.id,
          },
          this.messagingService.getSMSSenderNumber(brand),
        );
      } else if (order.domainNameEn === DomainNameEn.EN_PICKUP_IN_STORE) {
        const brand = this.getDomainNameFaFromOrder(order);
        await this.smsService.sendSMS(
          SMSTypes.PICK_UP_IN_STORE_ORDER_VERIFY,
          order?.user?.phoneNumber,
          {
            brand,
            orderId: order.id,
            link,
          },
          this.messagingService.getSMSSenderNumber(brand),
        );
      } else {
        const brand = this.getDomainNameFaFromOrder(order);
        await this.smsService.sendSMS(
          SMSTypes.ORDER_VERIFY,
          order?.user?.phoneNumber,
          {
            brand,
            fname: order?.user?.firstName,
            lname: order?.user?.lastName,
            link,
            orderId: order.id,
          },
          this.messagingService.getSMSSenderNumber(brand),
        );
      }
    } catch (error) {
      // Swallowed here (SMS failure must not fail the order) — logger.error
      // is the single Sentry capture; the extra captureException was a
      // duplicate (ADR-037 rule 8).
      this.logger.error(
        'payment_success_sms_failed',
        toError(error),
        'OrderService',
        { orderId: order.id, userId: order.userId },
      );
    }
  }

  /**
   * Resolves payment transaction for verify flow.
   * For ZarinPlus/AZKI loads by orderId; for other types by transactionId + paymentType.
   */
  private async getPaymentTransactionForVerify(
    paymentType: PaymentType,
    orderId: number,
    transactionId: string,
    queryRunner: QueryRunner,
  ): Promise<{
    paymentTransaction: PaymentTransactionEntity;
    transactionId: string;
  }> {
    if (
      paymentType === PaymentType.ZARINPLUS ||
      paymentType === PaymentType.AZKI
    ) {
      if (!orderId) {
        throw new BadRequestException(
          'orderId is required for zarinplus or azki payment',
        );
      }

      const orderById = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: {
          payment: {
            transactions: true,
          },
        },
        select: {
          id: true,
          paymentId: true,
          payment: {
            id: true,
            serviceId: true,
            transactions: {
              id: true,
              transactionId: true,
              paymentType: true,
              paymentId: true,
              state: true,
              price: true,
            },
          },
        },
        order: {
          payment: {
            transactions: { id: 'ASC' },
          },
        },
      });

      if (!orderById?.payment?.transactions?.length) {
        throw new BadRequestException('Payment transaction not found');
      }

      // ZarinPlus and Azki exception: callback sends only orderId, and each ZarinPlus or Azki order
      // has exactly one payment transaction, so we safely use the first transaction.
      const paymentTransaction = orderById.payment
        .transactions[0] as PaymentTransactionEntity;

      if (
        paymentTransaction.paymentType !== PaymentType.ZARINPLUS &&
        paymentTransaction.paymentType !== PaymentType.AZKI
      ) {
        throw new BadRequestException('Payment transaction type mismatch');
      }

      paymentTransaction.payment = orderById.payment as PaymentEntity;

      return {
        paymentTransaction,
        transactionId: paymentTransaction.transactionId,
      };
    }

    const paymentTransaction = await queryRunner.manager.findOne(
      PaymentTransactionEntity,
      {
        where: { transactionId, paymentType },
        relations: ['payment'],
      },
    );

    if (!paymentTransaction) {
      throw new BadRequestException('Payment transaction not found');
    }

    return { paymentTransaction, transactionId };
  }

  /**
   * ADR-037: mask card-ish fields (e.g. Tara sends `pan`) before logging
   * gateway callback payloads. Everything else in these callbacks is
   * transaction metadata we explicitly want in the logs.
   */
  private sanitizeGatewayCallback(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      out[k] = /pan|card/i.test(k) ? '***' : v;
    }
    return out;
  }

  async verifyOrder(
    req: Request,
    res: Response,
    paymentType: PaymentType,
    userId?: number,
    existingQueryRunner?: QueryRunner,
  ) {
    const shouldManageTransaction = !existingQueryRunner;
    const queryRunner =
      existingQueryRunner || this.dataSource.createQueryRunner();

    if (shouldManageTransaction) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }
    let failedPaymentFlag = false;
    // Flags to track external payment gateway state (for SnappPay / TorobPay)
    let paymentVerified = false;
    let paymentSettled = false;
    let paymentAlreadyRevertedOrCancelled = false;
    let disableRedirect = false;
    let trackingNumber = '';
    try {
      let transactionId = '';
      let skipThirdparty = false; // for create order for paid in snapp-pay
      let OrderId = 0;

      // Extract transaction ID based on payment type
      switch (paymentType) {
        case PaymentType.SAMAN:
          transactionId = String(req.body.ResNum);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;

        case PaymentType.SNAPP_PAY:
          transactionId = String(req.body.transactionId);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;

        case PaymentType.TOROB_PAY:
          transactionId = String(req.body.transactionId);
          skipThirdparty = Boolean(req.body.skipThirdparty);

          break;

        case PaymentType.ZARINPAL:
          transactionId = String(req.query.Authority);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;

        case PaymentType.TARA:
          transactionId = String(req.body.additionalData);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;

        case PaymentType.EWANO:
          transactionId = String(req.body.orderId);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          disableRedirect = true;
          break;

        case PaymentType.ITOL:
          transactionId = String(req.body.transactionId);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          disableRedirect = true;
          break;

        case PaymentType.DIGI_PAY:
          transactionId = String(req.body.providerId);
          trackingNumber = String(req.body.trackingCode);
          skipThirdparty = Boolean(req.body.skipThirdparty);

          break;
        case PaymentType.AZKI:
          OrderId = Number(req.query.orderId ?? req.body?.orderId ?? 0);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;
        case PaymentType.ZARINPLUS:
          OrderId = Number(req.query.orderId ?? req.body?.orderId ?? 0);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;
        case PaymentType.KEEPA:
          transactionId = String(req.query.token ?? req.body?.token ?? '');
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;
        case PaymentType.VIBE:
          transactionId = String(req.body?.ref_id ?? req.query.ref_id ?? '');
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;
        default:
          throw new BadRequestException('Unsupported payment type');
      }

      let paymentTransaction: PaymentTransactionEntity | null = null;
      const resolved = await this.getPaymentTransactionForVerify(
        paymentType,
        OrderId,
        transactionId,
        queryRunner,
      );
      paymentTransaction = resolved.paymentTransaction;
      transactionId = resolved.transactionId;

      // Forensics (ADR-037): one sanitized entry event per gateway callback —
      // the exact input the gateway sent us, queryable by transactionId.
      this.logger.log('gateway_callback_received', 'OrderService', {
        paymentType,
        transactionId,
        callback_body: this.sanitizeGatewayCallback(req.body),
        callback_query: this.sanitizeGatewayCallback(req.query),
      });

      // Check if this is a service payment - if so, delegate to service verification
      const payment = paymentTransaction.payment as PaymentEntity;

      if (payment?.serviceId) {
        // This is a service payment - delegate to service verification
        // Pass already-fetched data to avoid duplicate queries
        return await this.serviceService.verifyServicePayment(
          req,
          res,
          paymentType,
          paymentTransaction,
          payment,
          skipThirdparty,
          transactionId,
          queryRunner,
        );
      }

      // Find and update the order associated with the payment transaction
      // TODO: make this query more efficient (check relations and select only needed fields)
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { paymentId: paymentTransaction.paymentId },
        relations: {
          items: {
            config: {
              carPart: {
                joinCategories: {
                  category: true,
                },
              },
              supplier: true,
            },
          },
          parcels: {
            tempItems: true,
          },
          addressClone: true,
          payment: {
            transactions: true,
          },
          user: true,
        },
        order: {
          payment: {
            transactions: {
              id: 'ASC', //important transactions[0] !!
            },
          },
        },
      });

      // Skip payment verification if transaction is already SUCCESS and price is 0 (zero-amount order)
      const isZeroAmountOrder =
        paymentTransaction.state === PaymentTransactionState.SUCCESS &&
        paymentTransaction.price === 0;

      // temporary handle reserve
      if (
        order.items.some((item) =>
          item.isMarketplace
            ? item.config.sellerAvailableStock < item.quantity
            : item.config.warehouseAvailableStock < item.quantity,
        )
      ) {
        failedPaymentFlag = true;
      } else if (isZeroAmountOrder) {
        // Skip payment verification for zero-amount orders
        // Payment transaction is already marked as SUCCESS
      } else {
        // start payment verification
        switch (paymentType) {
          case PaymentType.SAMAN:
            if (
              process.env.NODE_ENV === 'development' ||
              process.env.NODE_ENV === 'staging'
            )
              break;
            if (skipThirdparty) break;
            if (this.saman.wasPaymentSuccessfull(req)) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const [status, RRN] = await this.saman.verifyPayment(req);
              trackingNumber = String(RRN);

              const takhfifanOrder =
                await this.takhfifanService.getTakhfifanByOrderId(order.id);
              if (takhfifanOrder) {
                const takhfifanPaymentPurchaseData =
                  await this.takhfifanPaymentService.preparationDataForPurchaseTakhfifanApi(
                    order,
                    takhfifanOrder.token,
                    paymentTransaction,
                  );

                // Api Purchase
                await this.takhfifanPaymentService.purchase(
                  takhfifanPaymentPurchaseData,
                );
              }
            } else {
              // Saman reported the payment as not completed (State !== 'OK')
              // — user cancelled/failed at the gateway, no verify attempted.
              // User cancel is not an error (ADR-037 rule 12) → info.
              this.logger.log('gateway_callback_unpaid', 'OrderService', {
                orderId: order.id,
                gateway: paymentType,
                transactionId,
              });
              gatewayCallbackUnpaidTotal.inc({
                gateway: 'saman',
                domain: getCurrentDomain(),
              });
              failedPaymentFlag = true;
            }
            break;

          case PaymentType.SNAPP_PAY:
            if (skipThirdparty) break;

            if (!this.snapp.wasPaymentSuccessfull(req)) {
              // The user abandoned/cancelled at the gateway: SnappPay still
              // calls this callback, with state=FAILED. Same handling as
              // Saman's State!=='OK' gate — mark the payment failed WITHOUT
              // a real verify call, so gateway_verify_* only ever counts
              // genuine verify attempts.
              this.logger.log('gateway_callback_unpaid', 'OrderService', {
                orderId: order.id,
                gateway: paymentType,
                transactionId,
              });
              gatewayCallbackUnpaidTotal.inc({
                gateway: 'snapp_pay',
                domain: getCurrentDomain(),
              });
              failedPaymentFlag = true;
              break;
            }

            // Verify with status fallback (as per SnapPay recommendations)
            const verifyResult = await this.snapp.verifyWithStatusFallback(
              paymentTransaction.extraInfo,
              paymentTransaction.transactionId,
            );

            if (!verifyResult.success) {
              // Error will be logged centrally by AllExceptionsFilter
              throw new BadRequestException('invalid-transactionId snapp');
            }

            paymentVerified = true;

            this.logger.log('snapp_verify_success', 'OrderService', {
              orderId: order.id,
              gateway: paymentType,
              transactionId: paymentTransaction.transactionId,
              shouldSettle: verifyResult.shouldSettle,
            });

            // Settle with status fallback if needed
            if (verifyResult.shouldSettle) {
              const settleResult = await this.snapp.settleWithStatusFallback(
                paymentTransaction.extraInfo,
                paymentTransaction.transactionId,
              );

              if (!settleResult.success) {
                // Swallowed into failedPaymentFlag (money failure) →
                // logger.error is the single Sentry capture.
                this.logger.error(
                  'snapp_settle_failed_reverting',
                  undefined,
                  'OrderService',
                  {
                    orderId: order.id,
                    gateway: paymentType,
                    operation: 'settle',
                    transactionId: paymentTransaction.transactionId,
                  },
                );
                await this.snapp.revert(paymentTransaction.extraInfo);
                paymentAlreadyRevertedOrCancelled = true;
                failedPaymentFlag = true;
              } else {
                this.logger.log('snapp_settle_success', 'OrderService', {
                  orderId: order.id,
                  gateway: paymentType,
                  operation: 'settle',
                  transactionId: paymentTransaction.transactionId,
                });
                paymentSettled = true;
              }
            } else {
              this.logger.log('snapp_already_settled', 'OrderService', {
                orderId: order.id,
                gateway: paymentType,
                operation: 'settle',
                transactionId: paymentTransaction.transactionId,
              });
              // Status was already SETTLE in verifyWithStatusFallback
              paymentSettled = true;
            }
            break;

          case PaymentType.TOROB_PAY:
            if (skipThirdparty) break;

            if (!this.torob.wasPaymentSuccessfull(req)) {
              // User abandoned/cancelled at the gateway (state=FAILED
              // callback) — no real verify call, same gate as
              // Saman/SnappPay (ADR-034).
              this.logger.log('gateway_callback_unpaid', 'OrderService', {
                orderId: order.id,
                gateway: paymentType,
                transactionId,
              });
              gatewayCallbackUnpaidTotal.inc({
                gateway: 'torob_pay',
                domain: getCurrentDomain(),
              });
              failedPaymentFlag = true;
              break;
            }

            if (
              (await this.torob.verify(paymentTransaction.extraInfo)) !==
              paymentTransaction.transactionId
            ) {
              throw new BadRequestException('invalid-transactionId torob');
            } else {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              paymentVerified = true;
              if (
                (await this.torob.settle(paymentTransaction.extraInfo)) !==
                paymentTransaction.transactionId
              ) {
                // Swallowed into failedPaymentFlag (money failure) —
                // logger.error is the single Sentry capture (ADR-037 rule 8).
                this.logger.error(
                  'torob_settle_failed_reverting',
                  undefined,
                  'OrderService',
                  {
                    orderId: order.id,
                    gateway: paymentType,
                    operation: 'settle',
                    transactionId: paymentTransaction.transactionId,
                  },
                );
                await this.torob.revert(paymentTransaction.extraInfo);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                paymentAlreadyRevertedOrCancelled = true;
                failedPaymentFlag = true;
              } else {
                this.logger.log('torob_settle_success', 'OrderService', {
                  orderId: order.id,
                  gateway: paymentType,
                  operation: 'settle',
                  transactionId: paymentTransaction.transactionId,
                });
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                paymentSettled = true;
              }
            }
            break;

          case PaymentType.DIGI_PAY:
            if (skipThirdparty) break;

            if (!this.digipayService.wasPaymentSuccessfull(req)) {
              // Digipay reported the payment as FAILURE in the callback —
              // user cancelled/failed at the gateway, no verify attempted
              // (same behaviour as before, now via the ADR-034 gate).
              this.logger.log('gateway_callback_unpaid', 'OrderService', {
                orderId: order.id,
                gateway: paymentType,
                transactionId,
              });
              gatewayCallbackUnpaidTotal.inc({
                gateway: 'digipay',
                domain: getCurrentDomain(),
              });
              failedPaymentFlag = true;
              break;
            }

            if (transactionId === order.payment.transactions[0].transactionId) {
              await this.digipayService.verifyOrder(
                trackingNumber,
                transactionId,
              );
            } else {
              throw new BadRequestException(
                'transactionId !== order.payment.transactions[0].transactionId',
              );
            }
            break;

          case PaymentType.EWANO:
            if (skipThirdparty) break;
            const result = await this.ewanoService.paymentByWallet(
              transactionId,
              userId || -1,
            );
            if (!result) {
              // Swallowed into failedPaymentFlag — single Sentry capture here.
              this.logger.error(
                'ewano_verify_failed',
                undefined,
                'OrderService',
                {
                  orderId: order.id,
                  gateway: paymentType,
                  operation: 'verify',
                  transactionId,
                },
              );
              failedPaymentFlag = true;
            }
            break;

          case PaymentType.ITOL:
            if (skipThirdparty) break;
            const result2 = await this.itol.verify(
              order.payment.transactions[0].transactionId,
              order.totalPrice * 10,
            );
            if (!result2) {
              // Swallowed into failedPaymentFlag — single Sentry capture here.
              this.logger.error(
                'itol_verify_failed',
                undefined,
                'OrderService',
                {
                  orderId: order.id,
                  gateway: paymentType,
                  operation: 'verify',
                  transactionId: order.payment.transactions[0].transactionId,
                },
              );
              failedPaymentFlag = true;
            }
            break;

          case PaymentType.TARA:
            if (skipThirdparty) break;

            if (!this.tara.wasPaymentSuccessfull(req)) {
              // Tara reported a user-rejected payment (result=68,
              // «تراکنش از طرف کاربر رد شده است») in the callback —
              // skip the verify API call entirely (ADR-034 gate).
              this.logger.log('gateway_callback_unpaid', 'OrderService', {
                orderId: order.id,
                gateway: paymentType,
                transactionId,
              });
              gatewayCallbackUnpaidTotal.inc({
                gateway: 'tara',
                domain: getCurrentDomain(),
              });
              failedPaymentFlag = true;
              break;
            }

            const taraVerifyPayment = await this.tara.verifyPayment(req);
            if (taraVerifyPayment.result === '0') {
              // TODO handle trace number or . . .
              trackingNumber = String(req?.body?.channelRefNumber);
            } else {
              // Swallowed into failedPaymentFlag — single Sentry capture here.
              this.logger.error(
                'tara_verify_failed',
                undefined,
                'OrderService',
                {
                  orderId: order.id,
                  gateway: paymentType,
                  operation: 'verify',
                  transactionId,
                  gatewayResult: taraVerifyPayment.result,
                },
              );
              failedPaymentFlag = true;
            }
            break;

          case PaymentType.AZKI: {
            if (skipThirdparty) break;
            const verifyResult = await this.azkiService.verifyTicket(
              transactionId,
            );
            if (
              verifyResult.rsCode === 0 &&
              verifyResult.result?.status === AzkiTicketStatus.DONE
            ) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              paymentVerified = true;
              trackingNumber = transactionId;
            } else {
              // Swallowed into failedPaymentFlag — single Sentry capture here.
              this.logger.error(
                'azki_verify_failed',
                undefined,
                'OrderService',
                {
                  orderId: order.id,
                  gateway: paymentType,
                  operation: 'verify',
                  transactionId,
                  rsCode: verifyResult.rsCode,
                  ticketStatus: verifyResult.result?.status,
                },
              );
              failedPaymentFlag = true;
            }
            break;
          }

          case PaymentType.ZARINPLUS: {
            if (skipThirdparty) break;
            const expectedAmount = paymentTransaction.price * 10;
            const verifyResult = await this.zarinPlusService.verifyPayment(
              transactionId,
              expectedAmount,
            );

            if (
              verifyResult.success &&
              verifyResult.code === 200 &&
              verifyResult.verifiedAmount === expectedAmount
            ) {
              trackingNumber = verifyResult.reference;
            } else {
              // Swallowed into failedPaymentFlag — single Sentry capture here.
              this.logger.error(
                'zarinplus_verify_failed',
                undefined,
                'OrderService',
                {
                  orderId: order.id,
                  gateway: paymentType,
                  operation: 'verify',
                  transactionId,
                  gatewayCode: verifyResult.code,
                  verifiedAmount: verifyResult.verifiedAmount,
                  expectedAmount,
                },
              );
              failedPaymentFlag = true;
            }
            break;
          }

          case PaymentType.KEEPA: {
            if (skipThirdparty) break;
            const keepaToken = order.payment.transactions[0].transactionId;
            const inquiryResult = await this.keepaService.inquirePayment(
              keepaToken,
            );
            if (inquiryResult.status === PaymentStatus.WaitingToVerify) {
              const verifyResult = await this.keepaService.verifyPayment({
                token: keepaToken,
                amount: paymentTransaction.price * 10,
              });
              trackingNumber = verifyResult.refNum;
            } else if (inquiryResult.status === PaymentStatus.Verified) {
              // Already verified (idempotency) - treat as success
            } else {
              // Swallowed into failedPaymentFlag — single Sentry capture here.
              this.logger.error(
                'keepa_verify_failed',
                undefined,
                'OrderService',
                {
                  orderId: order.id,
                  gateway: paymentType,
                  operation: 'verify',
                  transactionId: keepaToken,
                  inquiryStatus: inquiryResult.status,
                },
              );
              failedPaymentFlag = true;
            }
            break;
          }

          case PaymentType.VIBE: {
            if (skipThirdparty) break;
            // Swagger callback sends ?result=OK|NOK alongside ?ref_id=UUID.
            // If result=NOK the payment was cancelled by the user — mark failed
            // immediately without calling verifyOrder (ref_id may be absent).
            const vibeCallbackResult = String(
              req.body?.result ?? req.query?.result ?? '',
            );
            if (vibeCallbackResult === 'NOK') {
              // User cancelled at the gateway — not an error (ADR-037 rule 12).
              this.logger.log('gateway_callback_unpaid', 'OrderService', {
                orderId: order.id,
                gateway: paymentType,
                transactionId,
              });
              failedPaymentFlag = true;
              break;
            }
            const vibeRefId = paymentTransaction.transactionId;
            const vibeResult = await this.vibeService.verifyOrder(vibeRefId);
            if (!vibeResult.status) {
              // Swallowed into failedPaymentFlag — single Sentry capture here.
              this.logger.error(
                'vibe_verify_failed',
                undefined,
                'OrderService',
                {
                  orderId: order.id,
                  gateway: paymentType,
                  operation: 'verify',
                  transactionId: vibeRefId,
                },
              );
              failedPaymentFlag = true;
            }
            break;
          }

          default:
            throw new BadRequestException('Unsupported payment type');
        }
      }
      // end of payment verifications

      // D1 panel 302 numerator (ADR-026): gateway returned positive.
      if (!skipThirdparty && !isZeroAmountOrder && !failedPaymentFlag) {
        // Success/failure symmetry (ADR-037 rule 10): one success event per
        // genuine gateway verify, same field set as the *_verify_failed logs.
        this.logger.log('gateway_verify_success', 'OrderService', {
          orderId: order.id,
          gateway: paymentType,
          operation: 'verify',
          transactionId,
        });
        verifyOrderGatewaySuccessTotal.inc({
          gateway: paymentType,
          domain: getCurrentDomain(),
        });
      }

      try {
        if (failedPaymentFlag) {
          if (paymentTransaction.state === PaymentTransactionState.SUCCESS) {
            // Money anomaly: gateway said failed but our transaction is
            // already SUCCESS. Was Telegram-only — now also captured.
            this.logger.error(
              'verify_failed_but_transaction_already_success',
              undefined,
              'OrderService',
              {
                orderId: order.id,
                userId: order.userId,
                gateway: paymentType,
                transactionId: paymentTransaction.transactionId,
                paymentTransactionId: paymentTransaction.id,
              },
            );
            this.messagingService.sendTelegram(
              `باگ تارا اتفاق افتاد: ${order.userId}, orderId: ${order.id}, transactionId: ${paymentTransaction.id}`,
              '-1001923406236',
            );
          } else if (
            paymentTransaction.state === PaymentTransactionState.PENDING
          ) {
            await queryRunner.manager.update(
              PaymentTransactionEntity,
              { id: paymentTransaction.id },
              { state: PaymentTransactionState.FAILED },
            );
            // State transition: PENDING → FAILED (unpaid/failed callback).
            this.logger.log(
              'payment_transaction_marked_failed',
              'OrderService',
              {
                orderId: order.id,
                gateway: paymentType,
                transactionId: paymentTransaction.transactionId,
                paymentTransactionId: paymentTransaction.id,
              },
            );
            // switch (paymentType) {
            //   case PaymentType.SNAPP_PAY:
            //   case PaymentType.TOROB_PAY: {
            //     const handled = await this.compensatePaymentIfNeededForGateway({
            //       paymentType,
            //       skipThirdparty,
            //       paymentVerified,
            //       paymentSettled,
            //       paymentAlreadyRevertedOrCancelled,
            //       paymentExtraInfo: paymentTransaction?.extraInfo,
            //     });
            //     if (handled) {
            //       paymentAlreadyRevertedOrCancelled = true;
            //     }
            //     break;
            //   }
            //   case PaymentType.TARA:
            //     await this.tara.allRefund(
            //       String(req.body.channelRefNumber),
            //       ROBOTUSER.ROBOT_USER_ID,
            //     ); //req.body.channelRefNumber = trackingNumber
            //     break;
            //   default:
            //     break;
            // }
          } else {
            // Money anomaly: failed verify on a transaction that is neither
            // PENDING nor SUCCESS. Was Telegram-only — now also captured.
            this.logger.error(
              'verify_failed_unexpected_transaction_state',
              undefined,
              'OrderService',
              {
                orderId: order.id,
                userId: order.userId,
                gateway: paymentType,
                transactionId: paymentTransaction.transactionId,
                paymentTransactionId: paymentTransaction.id,
                state: paymentTransaction.state,
              },
            );
            this.messagingService.sendTelegram(
              `باگ ۲ تارا اتفاق افتاد: ${order.userId}, orderId: ${order.id}, transactionId: ${paymentTransaction.id}`,
              '-1001923406236',
            );
          }
        } else if (
          paymentTransaction.state === PaymentTransactionState.SUCCESS
        ) {
          // Idempotency guard: a previous (duplicate / retried) verify
          // callback already verified the payment and fully processed this
          // order. The active cart was moved to CHECKEDOUT and all side
          // effects (physical items, capacity, etc.) already ran, so there
          // is no active cart anymore. Skip reprocessing and fall through to
          // the success redirect instead of throwing "No active cart found".
          this.logger.warn(
            'verifyOrder_duplicate_for_success_order',
            'OrderService',
            {
              orderId: order.id,
              paymentTransactionId: paymentTransaction.id,
              currentState: paymentTransaction.state,
              paymentType,
              attempt: 'duplicate',
            },
          );
        } else {
          // Check if this is a pickup in store order
          const isPickupInStore =
            order.parcels[0]?.parcelDeliveryMethod ===
            ParcelDeliveryMethod.IN_STORE;
          const inStoreSupplierUserId = isPickupInStore
            ? order.parcels[0]?.inStoreSupplierUserId
            : undefined;

          const cart = await this.cartService.getActiveCart(
            order.userId,
            queryRunner,
            inStoreSupplierUserId,
          );

          await this.updateCartState(
            cart.id,
            CartStateEnum.CHECKEDOUT,
            queryRunner,
          );
          // State transition: active cart → CHECKEDOUT (ADR-037 rule 11).
          this.logger.log('order_cart_checkedout', 'OrderService', {
            orderId: order.id,
            cartId: cart.id,
            userId: order.userId,
            gateway: paymentType,
          });

          // Update payment transaction state to SUCCESS
          await queryRunner.manager.update(
            PaymentTransactionEntity,
            { id: paymentTransaction.id },
            { state: PaymentTransactionState.SUCCESS, trackingNumber },
          );
          // State transition: PENDING → SUCCESS (money path).
          this.logger.log(
            'payment_transaction_marked_success',
            'OrderService',
            {
              orderId: order.id,
              gateway: paymentType,
              transactionId: paymentTransaction.transactionId,
              paymentTransactionId: paymentTransaction.id,
              trackingNumber,
            },
          );

          for (const parcel of order.parcels) {
            // Skip deadline calculation and capacity allocation for pickup in store orders
            if (!isPickupInStore) {
              const parcelItems = parcel.tempItems.map((tempItem) =>
                order.items.find((item) => item.id === tempItem.id),
              );
              const isSBS =
                parcel.parcelDeliveryMethod === ParcelDeliveryMethod.SELLER;
              // For AUTOMOBY parcels, collect all marketplace supplier IDs
              const parcelSupplierUserIds = isSBS
                ? undefined
                : [
                    ...new Set(
                      parcelItems
                        .filter((item) => item?.isMarketplace)
                        .map((item) => item?.config?.supplierUserId)
                        .filter(Boolean),
                    ),
                  ];
              const deadline = await this.calculateDeadline(
                this.highestPeriod({ items: parcelItems }, isSBS),
                order.createdDate, // to include going to gateway time in calculation
                isSBS,
                parcel.shippingSupplierUserId,
                parcelSupplierUserIds,
              );

              // validateProcessDate
              const parcelDeadline =
                parcel.parcelDeliveryMethod === ParcelDeliveryMethod.SELLER
                  ? parcel.prepDeadline
                  : parcel.collectDeadline;
              if (
                parcelDeadline &&
                !Utils.isSameDay(deadline, parcelDeadline)
              ) {
                throw new BadRequestException(
                  'زمان ارسال سفارش شما به دلیل تکمیل ظرفیت پردازش تغییر یافت. لطفا مجددا تلاش کنید.',
                );
              }

              await queryRunner.manager.update(
                ParcelEntity,
                { id: parcel.id },
                {
                  prepDeadline:
                    parcel.parcelDeliveryMethod === ParcelDeliveryMethod.SELLER
                      ? deadline
                      : undefined,
                  collectDeadline:
                    parcel.parcelDeliveryMethod === ParcelDeliveryMethod.SELLER
                      ? undefined
                      : deadline,
                },
              );

              parcel.prepDeadline =
                parcel.parcelDeliveryMethod === ParcelDeliveryMethod.SELLER
                  ? deadline
                  : undefined;
              parcel.collectDeadline =
                parcel.parcelDeliveryMethod === ParcelDeliveryMethod.SELLER
                  ? undefined
                  : deadline;

              // State transition: parcel deadline computed & persisted.
              this.logger.log('parcel_deadline_set', 'OrderService', {
                orderId: order.id,
                parcelId: parcel.id,
                deliveryMethod: parcel.parcelDeliveryMethod,
                deadline,
              });

              if (parcel.parcelDeliveryMethod !== ParcelDeliveryMethod.SELLER) {
                await this.processCapacityService.allocateCapacity(
                  deadline,
                  1,
                  queryRunner,
                );
              } else if (parcel.shippingSupplierUserId) {
                // SBS: allocate supplier capacity if configured
                await this.supplierCalendarService.allocateCapacityForSupplier(
                  parcel.shippingSupplierUserId,
                  deadline,
                  1,
                  queryRunner,
                );
              }
            }

            // loop on parcel : create parcel

            for (const tempItem of parcel.tempItems) {
              const orderItem = order.items.find(
                (item) => item.id === tempItem.id,
              );

              if (!orderItem) {
                throw new BadRequestException(
                  `Order item with ID ${tempItem.id} not found in order ${order.id}`,
                );
              }

              await this.physicalItemService.createPhysicalItemForVerifyOrder(
                orderItem,
                parcel,
                isPickupInStore,
                queryRunner,
              );

              if (orderItem?.config?.carPart?.isTireDolati) {
                await this.addGovermentTire(
                  order.userId,
                  orderItem.quantity,
                  orderItem?.config?.carPart?.id,
                  order.id,
                  queryRunner,
                );
              }
            }

            // State transition: physical items materialized for this parcel.
            this.logger.log('order_physical_items_created', 'OrderService', {
              orderId: order.id,
              parcelId: parcel.id,
              itemCount: parcel.tempItems.length,
            });

            // Handle parcel state based on order type
            if (isPickupInStore) {
              await this.parcelService.markPickupInStoreDelivered(
                parcel.id,
                order.userId,
                queryRunner,
              );
            } else if (
              parcel.parcelDeliveryMethod === ParcelDeliveryMethod.SELLER
            ) {
              await this.parcelService.startSellerConfirmProccessing(
                parcel.id,
                order.userId,
                queryRunner,
              );
            } else {
              await this.parcelService.startProccessing(
                parcel.id,
                order.userId,
                queryRunner,
              );
            }
          }

          if (order.discountId) {
            await queryRunner.manager.decrement(
              DiscountEntity,
              { id: order.discountId },
              'count',
              1,
            );
          }
          if (!isPickupInStore) {
            await this.reduceConfigQuantities(order.items, queryRunner);
            // State transition: goods stock decremented after paid verify.
            this.logger.log('order_inventory_decremented', 'OrderService', {
              orderId: order.id,
              itemCount: order.items.length,
            });
          }

          // Installation: transition this order's reserves from
          // PAYMENT_PENDING_INSTALLATION → PENDING_TECHNICIAN_CONFIRMATION and
          // decrement AMPT.inventory per item — in the same transaction as the
          // goods-side stock decrement above. No-op if the order has no reserves.
          await this.installationCheckoutService.confirmReservesAfterPayment(
            order.id,
            queryRunner,
          );
        }
      } catch (error) {
        // switch (paymentType) {
        //   case PaymentType.SNAPP_PAY:
        //   case PaymentType.TOROB_PAY: {
        //     const handled = await this.compensatePaymentIfNeededForGateway({
        //       paymentType,
        //       skipThirdparty,
        //       paymentVerified,
        //       paymentSettled,
        //       paymentAlreadyRevertedOrCancelled,
        //       paymentExtraInfo: paymentTransaction?.extraInfo,
        //     });
        //     if (handled) {
        //       paymentAlreadyRevertedOrCancelled = true;
        //     }
        //     throw error;
        //   }
        //   case PaymentType.TARA:
        //     await this.tara.allRefund(
        //       String(req.body.channelRefNumber),
        //       ROBOTUSER.ROBOT_USER_ID,
        //     ); //req.body.channelRefNumber = trackingNumber
        //     throw error;
        //   default:
        //     throw error;
        // }
        throw error;
      }

      const redirectToOrg = order.redirectToOrg;

      // Determine base URL based on redirect flag and domain
      let baseUrl: string;
      if (order.domainNameEn === DomainNameEn.EN_AUTOMOBY_NET) {
        baseUrl = process.env.FRONT_SITE_ADDRESS_ALT;
      } else if (order.domainNameEn === DomainNameEn.EN_PARTIFA) {
        baseUrl = process.env.FRONT_SITE_ADDRESS_PARTIFA;
      } else if (order.domainNameEn === DomainNameEn.EN_EWANO) {
        baseUrl = 'https://hga.automoby.ir';
      } else if (order.domainNameEn === DomainNameEn.EN_AUTOMOBY_ORG) {
        baseUrl = process.env.FRONT_SITE_ADDRESS_ORG;
      } else if (order.domainNameEn === DomainNameEn.EN_AUTOMOBY_SHOP) {
        baseUrl = process.env.FRONT_SITE_ADDRESS_SHOP;
      } else if (order.domainNameEn === DomainNameEn.EN_AUTOMOBY_SUPPLY) {
        baseUrl = process.env.FRONT_SITE_ADDRESS_SUPPLY;
      } else if (order.domainNameEn === DomainNameEn.EN_BARPART) {
        baseUrl = process.env.FRONT_SITE_ADDRESS_BARPART;
      } else if (order.domainNameEn === DomainNameEn.EN_PICKUP_IN_STORE) {
        baseUrl = process.env.FRONT_SITE_ADDRESS_PICKUP_IN_STORE;
      } else if (order.domainNameEn === DomainNameEn.EN_AUTOMOBY_HGA) {
        baseUrl = process.env.FRONT_SITE_ADDRESS_HGA;
      } else {
        baseUrl = process.env.FRONT_SITE_ADDRESS || 'http://localhost:3000';
      }

      // Build final redirect URL
      const orderPageUrl = process.env.ORDER_PAGE_URL || '/checkout/callback';
      const finalRedirect = `${baseUrl}${orderPageUrl}/${order.id}?org_redirect=${redirectToOrg}`;

      await queryRunner.commitTransaction();

      // Call campaign service to add purchase bonus chances (only if payment was successful)
      // if (!failedPaymentFlag) {
      //   try {
      //     await this.campaignService.onOrderCreated(order);
      //   } catch (error) {
      //     this.logger.error('Error in campaign onOrderCreated', error);
      //     // Don't fail the order verification if campaign service fails
      //   }
      // }

      try {
        if (!skipThirdparty && !failedPaymentFlag)
          this.sendPaymentSuccessSms(order);
      } catch (e) {
        // Swallowed (notification failure must not fail the verify) —
        // logger.error is the single Sentry capture.
        this.logger.error(
          'payment_success_notification_failed',
          toError(e),
          'OrderService',
          { userId: order.userId, orderId: order.id, gateway: paymentType },
        );
      }

      // D1 panel 302 denominator (ADR-026): same guard as numerator —
      // gap means something threw between gateway switch and here.
      if (!skipThirdparty && !isZeroAmountOrder && !failedPaymentFlag) {
        verifyOrderSuccessTotal.inc({
          gateway: paymentType,
          domain: getCurrentDomain(),
        });
      }

      // Funnel terminal stage (ADR-036) — scope-matched to payment_initiated:
      // zero-amount and skipThirdparty completions ARE completed purchases, so
      // only failed payments are excluded (unlike the ADR-026 ratio counters).
      // Pickup orders also get a parcel, so order_type is derived from the
      // address snapshot instead (pickup flow never sets one).
      if (!failedPaymentFlag) {
        checkoutFunnelTotal.inc({
          domain: order.domainNameEn ?? 'unknown',
          stage: 'payment_verified',
          order_type: order.addressClone ? 'delivery' : 'pickup',
        });
      }

      if (
        (process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV === 'staging') &&
        paymentType !== PaymentType.ITOL &&
        paymentType !== PaymentType.AZKI &&
        paymentType !== PaymentType.ZARINPLUS
      )
        return;

      if (!disableRedirect) {
        res.redirect(finalRedirect);
      } else {
        res.send({
          sucess: true,
        });
      }
    } catch (error) {
      if (shouldManageTransaction) {
        await queryRunner.rollbackTransaction();
      }
      // ADR-037: was console.error (bypassed pino → shredded stdout, no Sentry).
      this.logger.error(
        'verifyOrder_transaction_failed',
        toError(error),
        'OrderService',
        { paymentType },
      );
      throw error;
    } finally {
      if (shouldManageTransaction) {
        await queryRunner.release();
      }
    }
  }

  async validateAndGetAddress(
    dto: CreateOrderDto,
    userId: number,
    queryRunner: QueryRunner,
  ): Promise<AddressCloneEntity> {
    this.logger.debug('checkout_address_validate', 'OrderService', {
      userId,
      addressId: dto.addressId,
    });
    const originalAddress = await queryRunner.manager.findOne(AddressEntity, {
      where: { userId, id: dto.addressId },
    });

    if (!originalAddress) {
      // Client/validation problem → warn, not error (ADR-037 rule 12).
      // statusCode 400 keeps LoggerService.warn from Sentry-capturing it.
      this.logger.warn('checkout_address_invalid', 'OrderService', {
        userId,
        addressId: dto.addressId,
        statusCode: 400,
      });
      throw new BadRequestException('invalid-address');
    }

    const originalAddressWithoutId = Object.fromEntries(
      Object.entries(originalAddress).filter(([key]) => key !== 'id'),
    );

    const addressClone = { ...originalAddressWithoutId };
    const savedAddressClone = await queryRunner.manager.save(
      AddressCloneEntity,
      addressClone,
    );
    return savedAddressClone;
  }

  private async compensatePaymentIfNeededForGateway(options: {
    paymentType: PaymentType;
    skipThirdparty: boolean;
    paymentVerified: boolean;
    paymentSettled: boolean;
    paymentAlreadyRevertedOrCancelled: boolean;
    paymentExtraInfo: string;
  }): Promise<boolean> {
    if (options.paymentAlreadyRevertedOrCancelled) {
      return false;
    }

    switch (options.paymentType) {
      case PaymentType.SNAPP_PAY:
        if (!options.skipThirdparty) {
          if (options.paymentSettled) {
            await this.snapp.cancel(options.paymentExtraInfo);
          } else if (options.paymentVerified) {
            await this.snapp.revert(options.paymentExtraInfo);
          } else {
            await this.snapp.cancel(options.paymentExtraInfo);
          }
          return true;
        }
        return false;
      case PaymentType.TOROB_PAY:
        if (options.paymentSettled) {
          await this.torob.cancel(options.paymentExtraInfo);
        } else if (options.paymentVerified) {
          await this.torob.revert(options.paymentExtraInfo);
        } else {
          await this.torob.cancel(options.paymentExtraInfo);
        }
        return true;
      default:
        return false;
    }
  }

  applyDiscount(
    totalPrice: number,
    discount?: { amountType: string; amount: number },
  ) {
    if (!discount) return totalPrice;
    if (discount.amountType === 'AMOUNT') {
      return Math.max(totalPrice - discount.amount, 0); // Ensure total doesn't go negative
    } else if (discount.amountType === 'PERCENT') {
      return totalPrice * ((100 - discount.amount) / 100);
    }
    return totalPrice;
  }

  getPeriodLength(period: SellerCollectPeriod | SBSPrepTimeEnum): number {
    const periodHours: Record<
      keyof typeof SellerCollectPeriod | keyof typeof SBSPrepTimeEnum,
      number
    > = {
      UNDER0HOURS: 0,
      UNDER1HOURS: 1,
      UNDER2HOURS: 2,
      UNDER3HOURS: 3,
      UNDER4HOURS: 4,
      UNDER5HOURS: 5,
      UNDER6HOURS: 6,
      UNDER24HOURS: 24,
      UNDER48HOURS: 48,
      UNDER72HOURS: 72,
      UNDER96HOURS: 96,
      UNDER120HOURS: 120,
    };

    const key = period as keyof typeof periodHours;

    if (key in periodHours) {
      return periodHours[key];
    }
    throw new BadRequestException('Unexpected period value in getPeriodLength');
  }

  async getWorkingHours(
    currentDate: Date,
    shipBySeller: boolean = false,
    supplierUserId?: number,
  ): Promise<{ start: number; end: number }> {
    if (shipBySeller) {
      return await this.supplierService.getSupplierWorkingHours(
        supplierUserId,
        currentDate,
      );
    } else {
      // shipByAutomoby
      return {
        start: 9,
        end: currentDate.getDay() === 4 ? 13 : 17,
      };
    }
  }

  async calculateDeadline(
    period: SellerCollectPeriod | SBSPrepTimeEnum,
    from?: Date,
    shipBySeller: boolean = false,
    supplierUserId?: number,
    supplierUserIds?: number[],
  ): Promise<Date> {
    const currentDate = from || new Date();
    // For SBS, wrap single supplierUserId into array for unified handling
    const effectiveSupplierIds =
      supplierUserIds ??
      (shipBySeller && supplierUserId ? [supplierUserId] : undefined);
    const availableStartDate = await this.getNextAvailableDate(
      currentDate,
      shipBySeller,
      1,
      effectiveSupplierIds,
    );
    const periodLength = this.getPeriodLength(period);
    const periodHours = periodLength % 24; // Ensure period is in hours
    const periodDays = Math.floor(periodLength / 24);
    const workingHours = await this.getWorkingHours(
      availableStartDate,
      shipBySeller,
      supplierUserId,
    );

    // Check if current date is a working day
    const isCurrentDayAvailable = Utils.isSameDay(
      currentDate,
      availableStartDate,
    );

    if (isCurrentDayAvailable) {
      return this.calculateDeadlineForCurrentDay(
        currentDate,
        periodLength,
        periodHours,
        periodDays,
        workingHours,
        shipBySeller,
        effectiveSupplierIds,
      );
    } else {
      return this.calculateDeadlineForFutureDay(
        availableStartDate,
        periodHours,
        periodDays,
        shipBySeller,
        effectiveSupplierIds,
      );
    }
  }

  private async calculateDeadlineForCurrentDay(
    currentDate: Date,
    periodLength: number,
    periodHours: number,
    periodDays: number,
    workingHours: { start: number; end: number },
    shipBySeller: boolean,
    supplierUserIds?: number[],
  ): Promise<Date> {
    const currentHour = currentDate.getHours();

    if (periodLength < 24) {
      // Hour mode: Add hours to current time
      return this.handleHourModeForCurrentDay(
        currentDate,
        currentHour,
        periodHours,
        workingHours,
        shipBySeller,
        supplierUserIds,
      );
    } else {
      // Day mode: Calculate based on working hours
      return this.handleDayModeForCurrentDay(
        currentDate,
        currentHour,
        periodDays,
        workingHours,
        shipBySeller,
        supplierUserIds,
      );
    }
  }

  private async calculateDeadlineForFutureDay(
    seenDate: Date,
    periodHours: number,
    periodDays: number,
    shipBySeller: boolean,
    supplierUserIds?: number[],
  ): Promise<Date> {
    let finalDate = seenDate;
    if (periodDays > 0)
      finalDate = await this.getNextAvailableDate(
        seenDate,
        shipBySeller,
        periodDays,
        supplierUserIds,
      );

    const nextWorkingHours = await this.getWorkingHours(
      finalDate,
      shipBySeller,
      shipBySeller ? undefined : finalDate.getDay(),
    );

    if (periodHours < 24) {
      // Hour mode: Set to start of working hours + period hours
      finalDate.setHours(nextWorkingHours.start + periodHours, 0, 0, 0);
    } else {
      // Day mode: Set to end of working hours
      finalDate.setHours(nextWorkingHours.end, 0, 0, 0);
    }

    return finalDate;
  }

  private async handleHourModeForCurrentDay(
    currentDate: Date,
    currentHour: number,
    periodHours: number,
    workingHours: { start: number; end: number },
    shipBySeller: boolean,
    supplierUserIds?: number[],
  ): Promise<Date> {
    const targetHour = currentHour + periodHours;

    if (this.isWithinWorkingHours(currentHour, targetHour, workingHours)) {
      // Can complete within today's working hours
      const deadline = new Date(currentDate);
      deadline.setHours(currentHour + periodHours);
      return deadline;
    } else if (currentHour < workingHours.start) {
      // before working hours
      const deadline = new Date(currentDate);
      deadline.setHours(workingHours.start + periodHours, 0, 0, 0);
      return deadline;
    } else {
      // after working hours
      // Need to move to next available working day
      const nextWorkingDay = await this.getNextAvailableDate(
        Utils.addOneDay(currentDate),
        shipBySeller,
        1,
        supplierUserIds,
      );
      const nextWorkingHours = await this.getWorkingHours(
        nextWorkingDay,
        shipBySeller,
      );
      nextWorkingDay.setHours(nextWorkingHours.start + periodHours, 0, 0, 0);
      return nextWorkingDay;
    }
  }

  private async handleDayModeForCurrentDay(
    currentDate: Date,
    currentHour: number,
    periodDays: number,
    workingHours: { start: number; end: number },
    shipBySeller: boolean,
    supplierUserIds?: number[],
  ): Promise<Date> {
    if (this.isWithinWorkingHours(currentHour, currentHour, workingHours)) {
      // Order seen during working hours
      // deadline is next available day at current hour
      const nextWorkingDay = await this.getNextAvailableDate(
        Utils.addOneDay(currentDate),
        shipBySeller,
        periodDays,
        supplierUserIds,
      );
      nextWorkingDay.setHours(currentHour, currentDate.getMinutes(), 0, 0);
      return nextWorkingDay;
    } else if (currentHour < workingHours.start) {
      // Order will see start of working hours
      // deadline is today at end of working hours
      const nextWorkingDay = await this.getNextAvailableDate(
        currentDate,
        shipBySeller,
        periodDays,
        supplierUserIds,
      );
      const nextWorkingHours = await this.getWorkingHours(
        nextWorkingDay,
        shipBySeller,
      );
      nextWorkingDay.setHours(nextWorkingHours.end, 0, 0, 0);
      return nextWorkingDay;
    } else {
      // Order outside working hours will see next working day
      // deadline is next available day at end of working hours
      const nextWorkingDay = await this.getNextAvailableDate(
        Utils.addOneDay(currentDate),
        shipBySeller,
        periodDays,
        supplierUserIds,
      );
      const nextWorkingHours = await this.getWorkingHours(
        nextWorkingDay,
        shipBySeller,
      );
      nextWorkingDay.setHours(nextWorkingHours.end, 0, 0, 0);
      return nextWorkingDay;
    }
  }

  private isWithinWorkingHours(
    startHour: number,
    endHour: number,
    workingHours: { start: number; end: number },
  ): boolean {
    return startHour >= workingHours.start && endHour <= workingHours.end;
  }

  async getNextAvailableDate(
    date: Date,
    shipBySeller: boolean,
    nthDay: number = 1,
    supplierUserIds?: number[],
  ): Promise<Date> {
    if (shipBySeller) {
      // SBS: use supplier-specific calendar if available
      if (supplierUserIds?.length === 1) {
        return await this.supplierCalendarService.getNextWorkingDayForSupplier(
          supplierUserIds[0],
          date,
          nthDay,
        );
      }
      return await this.processCapacityService.getNextWorkingDayFrom(
        date,
        nthDay,
      );
    } else {
      // AUTOMOBY: check global capacity + all suppliers working
      if (supplierUserIds?.length > 0) {
        return await this.supplierCalendarService.getNextAvailableProcessDateWithSuppliers(
          date,
          nthDay,
          supplierUserIds,
        );
      }
      return await this.processCapacityService.getNextAvailableProcessDateFrom(
        date,
        nthDay,
      );
    }
  }

  async createOrderFromCart(
    userId: number,
    validItems: CartItemEntity[],
    parcels: ParcelWithShippingType[],
    paymentType: PaymentType,
    addressClone: AddressCloneEntity | null,
    discount: IDiscount,
    totalPrice: number,
    tatoken: string | undefined,
    utm: Utm[] | undefined,
    queryRunner: QueryRunner,
    abTestVariants?: AbTestVariants,
  ): Promise<OrderEntity> {
    const order = new OrderEntity();
    // Populate order fields based on cart and input parameters
    order.userId = userId;
    order.totalPrice = totalPrice;
    order.discountId = discount ? discount.id : null;
    // install-only orders (OI-4 case C) have no delivery address
    order.addressCloneId = addressClone?.id ?? null;
    order.paymentType = paymentType;
    order.domainNameEn = this.als.getStore()['domainName'].en as DomainNameEn;
    if (utm && utm.length >= 1) {
      order.utm = JSON.stringify(utm[utm.length - 1]);
    }

    const createdOrder = await queryRunner.manager.save(OrderEntity, order);

    // NOTE: payment_initiated is deliberately NOT emitted here — this runs
    // inside the checkout transaction; a later failure (payment/gateway
    // create) rolls the order back and the funnel would over-count. The
    // stage is emitted after commitTransaction in proceedCheckout (ADR-036).

    // ذخیره اطلاعات A/B test در جدول جداگانه اگر فعال بود
    const abTestVariantForOrder =
      abTestVariants?.pricing_shipping_markup_per_category_strategy ??
      abTestVariants?.pricing_shipping_markup_strategy ??
      abTestVariants?.price_strategy ??
      abTestVariants?.pricing_shipping_strategy;
    if (abTestVariants && abTestVariantForOrder) {
      const abTestVariant = abTestVariantForOrder;
      const orderExperiment = queryRunner.manager.create(
        OrderExperimentEntity,
        {
          orderId: createdOrder.id,
          experimentId:
            abTestVariant.experiment?.id || abTestVariant.experimentId,
          variantId: abTestVariant.id,
        },
      );
      await queryRunner.manager.save(OrderExperimentEntity, orderExperiment);
    }

    const shippingDiscountPercent = await this.getShippingDiscountPercent(
      paymentType,
    );

    // Get payment gateway fee percentage once (with join ids for AB test markup)
    const categoryIds = Utils.extractCarPartCategoryIds(validItems);
    const feeMapWithJoinIds = await this.getPaymentGatewayFeeWithJoinIds(
      categoryIds,
      paymentType,
      order.domainNameEn,
    );

    for (const parcel of parcels) {
      const shipping = parcel.shippingType;
      const courier = shipping.courier;

      // Check if the parcel size is GOVERNMENT_TIRES or TIRE
      if (
        (shipping.size === CarPartSize.GOVERNMENT_TIRES ||
          shipping.size === CarPartSize.TIRE) &&
        courier !== ParcelShippingCourier.SNAPP
      ) {
        // Calculate total quantity of all items in the parcel
        const totalQuantity = parcel.parcel.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );

        // For each item in the parcel, break it into multiple parcels/items with quantity = 1
        for (const item of parcel.parcel) {
          // محاسبه قیمت‌ها با احتساب A/B test
          const pricingCfg = this.abTestService.getPricingConfig(
            item.configId,
            item.config.carPart.joinCategories[0].categoryId,
            abTestVariants,
          );
          const itemPrice = pricingCfg
            ? Utils.roundPrice(
                Math.ceil(item.config.price * pricingCfg.marginMultiplier),
                3,
              )
            : Utils.roundPrice(item.config.price, 3);
          const itemBasePrice = pricingCfg
            ? Utils.roundPrice(
                Math.ceil(item.config.basePrice * pricingCfg.marginMultiplier),
                3,
              )
            : Utils.roundPrice(item.config.basePrice, 3);

          const itemPricePerDomain = Utils.calculatePricePerDomainAndCategory(
            this.als.getStore()['domainName'].en,
            item.config.carPart.joinCategories[0].categoryId,
            itemPrice,
          );

          const itemBasePricePerDomain =
            Utils.calculatePricePerDomainAndCategory(
              this.als.getStore()['domainName'].en,
              item.config.carPart.joinCategories[0].categoryId,
              itemBasePrice,
            );

          // Calculate and store fee for this item (with AB test markup override)
          const { feePercent: baseFeePercent, dpgCatJoinId } =
            this.getItemFeePercentAndJoinId(item, feeMapWithJoinIds);
          const hasFee = dpgCatJoinId !== undefined;
          const markupCfg = this.abTestService.getMarkupOverride(
            dpgCatJoinId,
            abTestVariants,
          );
          const itemFeePercent =
            markupCfg !== null ? markupCfg.feePercent : baseFeePercent;

          const feeAmountBasePrice = this.calculateItemFee(
            itemBasePricePerDomain,
            1,
            itemFeePercent,
            hasFee,
          );
          const feeAmountPrice = this.calculateItemFee(
            itemPricePerDomain,
            1,
            itemFeePercent,
            hasFee,
          );

          for (let i = 0; i < item.quantity; i++) {
            const parcelEntity = new ParcelEntity();
            parcelEntity.orderId = createdOrder.id;
            parcelEntity.shippingType = shipping.shippingType;
            parcelEntity.size = shipping.size ?? CarPartSize.TIRE;
            const baseShippingCost = Math.round(shipping.price / totalQuantity);
            parcelEntity.baseShippingCost = baseShippingCost;
            parcelEntity.shippingCost = this.calculateDiscountedShippingCost(
              baseShippingCost,
              shippingDiscountPercent,
            );
            parcelEntity.packingCost = Math.round(
              (shipping.packingCost || 0) / totalQuantity,
            );
            parcelEntity.shippingDuration = shipping.shippingDuration;
            parcelEntity.parcelDeliveryMethod = shipping.isShipBySeller
              ? ParcelDeliveryMethod.SELLER
              : ParcelDeliveryMethod.AUTOMOBY;
            parcelEntity.prepDeadline = shipping.prepDeadline;
            parcelEntity.collectDeadline = shipping.collectDeadline;
            parcelEntity.isExpressShipping = shipping.isExpressShipping;
            parcelEntity.deliveryDeadline = shipping.deliveryDeadline;
            parcelEntity.shippingSupplierUserId = shipping.supplierUserId;
            parcelEntity.state = ParcelStateEnum.PAYMENT_PENDING;
            parcelEntity.courier = shipping.courier ?? null;
            // parcelEntity.freeShippingReason = shipping.freeShippingReason;

            const createdParcel = await queryRunner.manager.save(
              ParcelEntity,
              parcelEntity,
            );

            const orderItem = new OrderItemEntity();
            orderItem.orderId = createdOrder.id;
            orderItem.configId = item.configId;
            orderItem.tempParcelId = createdParcel.id;
            orderItem.quantity = 1;
            orderItem.isMarketplace = item.isMarketplace;
            orderItem.checkoutPurchasePrice = item.config.purchasePrice;

            orderItem.checkoutBasePrice =
              itemBasePricePerDomain + feeAmountBasePrice;
            orderItem.checkoutPrice = itemPricePerDomain + feeAmountPrice;
            orderItem.feeAmount = feeAmountPrice;

            await queryRunner.manager.save(OrderItemEntity, orderItem);
          }
        }
      } else {
        // Default behavior for other sizes
        const parcelEntity = new ParcelEntity();
        parcelEntity.orderId = createdOrder.id;
        parcelEntity.shippingType = shipping.shippingType;
        parcelEntity.size = shipping.size ?? CarPartSize.TIRE;
        parcelEntity.baseShippingCost = shipping.price;
        parcelEntity.shippingCost = this.calculateDiscountedShippingCost(
          shipping.price,
          shippingDiscountPercent,
        );
        parcelEntity.packingCost = shipping.packingCost || 0;
        parcelEntity.shippingDuration = shipping.shippingDuration;
        parcelEntity.parcelDeliveryMethod = shipping.isShipBySeller
          ? ParcelDeliveryMethod.SELLER
          : ParcelDeliveryMethod.AUTOMOBY;
        parcelEntity.prepDeadline = shipping.prepDeadline;
        parcelEntity.collectDeadline = shipping.collectDeadline;
        parcelEntity.isExpressShipping = shipping.isExpressShipping;
        parcelEntity.deliveryDeadline = shipping.deliveryDeadline;
        parcelEntity.shippingSupplierUserId = shipping.supplierUserId;
        parcelEntity.state = ParcelStateEnum.PAYMENT_PENDING;
        parcelEntity.courier = shipping.courier ?? null;
        // parcelEntity.freeShippingReason = shipping.freeShippingReason;

        const createdParcel = await queryRunner.manager.save(
          ParcelEntity,
          parcelEntity,
        );

        for (const item of parcel.parcel) {
          // محاسبه قیمت‌ها با احتساب A/B test
          const pricingCfg = this.abTestService.getPricingConfig(
            item.configId,
            item.config.carPart.joinCategories[0].categoryId,
            abTestVariants,
          );
          const itemPrice = pricingCfg
            ? Utils.roundPrice(
                Math.ceil(item.config.price * pricingCfg.marginMultiplier),
                3,
              )
            : Utils.roundPrice(item.config.price, 3);
          const itemBasePrice = pricingCfg
            ? Utils.roundPrice(
                Math.ceil(item.config.basePrice * pricingCfg.marginMultiplier),
                3,
              )
            : Utils.roundPrice(item.config.basePrice, 3);

          const itemPricePerDomain = Utils.calculatePricePerDomainAndCategory(
            this.als.getStore()['domainName'].en,
            item.config.carPart.joinCategories[0].categoryId,
            itemPrice,
          );

          const itemBasePricePerDomain =
            Utils.calculatePricePerDomainAndCategory(
              this.als.getStore()['domainName'].en,
              item.config.carPart.joinCategories[0].categoryId,
              itemBasePrice,
            );

          // Calculate and store fee for this item (with AB test markup override)
          const { feePercent: baseFeePercent, dpgCatJoinId } =
            this.getItemFeePercentAndJoinId(item, feeMapWithJoinIds);
          const hasFee = dpgCatJoinId !== undefined;
          const markupCfg = this.abTestService.getMarkupOverride(
            dpgCatJoinId,
            abTestVariants,
          );
          const itemFeePercent =
            markupCfg !== null ? markupCfg.feePercent : baseFeePercent;
          const feeAmountPrice = this.calculateItemFee(
            itemPricePerDomain,
            1,
            itemFeePercent,
            hasFee,
          );
          const feeAmountBasePrice = this.calculateItemFee(
            itemBasePricePerDomain,
            1,
            itemFeePercent,
            hasFee,
          );
          const orderItem = new OrderItemEntity();
          orderItem.orderId = createdOrder.id;
          orderItem.configId = item.configId;
          orderItem.tempParcelId = createdParcel.id;
          orderItem.quantity = item.quantity;
          orderItem.isMarketplace = item.isMarketplace;

          orderItem.checkoutPurchasePrice = item.config.purchasePrice;

          orderItem.checkoutBasePrice =
            itemBasePricePerDomain + feeAmountBasePrice;
          orderItem.checkoutPrice = itemPricePerDomain + feeAmountPrice;

          orderItem.feeAmount = feeAmountPrice;
          await queryRunner.manager.save(OrderItemEntity, orderItem);
        }
      }
    }

    if (tatoken) {
      await this.takhfifanService.createTakhfifanOrder(
        {
          orderId: createdOrder.id,
          token: tatoken,
        },
        queryRunner,
      );
    }

    return createdOrder;
  }

  async createOrderFromCartPickupInStore(
    userId: number,
    validItems: CartItemEntity[],
    paymentType: PaymentType,
    inStoreSupplierUserId: number,
    supplierShopAddress: string,
    discount: IDiscount,
    totalPrice: number,
    discountAmount: number,
    utm: Utm[] | undefined,
    queryRunner: QueryRunner,
  ): Promise<OrderEntity> {
    const order = new OrderEntity();
    // Populate order fields based on cart and input parameters
    order.userId = userId;
    order.totalPrice = totalPrice;
    order.discountId = discount ? discount.id : null;
    order.discountAmount = discountAmount;
    order.addressCloneId = null; // No address for pickup in store
    order.paymentType = paymentType;
    order.domainNameEn = this.als.getStore()['domainName'].en as DomainNameEn;
    if (utm && utm.length >= 1) {
      order.utm = JSON.stringify(utm[utm.length - 1]);
    }

    const createdOrder = await queryRunner.manager.save(OrderEntity, order);

    // NOTE: payment_initiated is emitted after commitTransaction in
    // proceedCheckoutPickupInStore, not here (rollback would over-count).

    // Create a single parcel for all items in pickup in store
    const parcelEntity = new ParcelEntity();
    parcelEntity.orderId = createdOrder.id;
    parcelEntity.shippingType = ShippingType.ECONOMY; // Default value
    parcelEntity.size = CarPartSize.TIRE;
    parcelEntity.shippingCost = 0; // No shipping cost for pickup in store
    parcelEntity.baseShippingCost = 0;
    parcelEntity.packingCost = 0;
    parcelEntity.shippingDuration = ShippingDurationEnum.UNDER0HOURS;
    parcelEntity.parcelDeliveryMethod = ParcelDeliveryMethod.IN_STORE;
    parcelEntity.prepDeadline = null;
    parcelEntity.collectDeadline = null;
    parcelEntity.isExpressShipping = false;
    parcelEntity.deliveryDeadline = null;
    parcelEntity.shippingSupplierUserId = null;
    parcelEntity.inStoreSupplierUserId = inStoreSupplierUserId;
    parcelEntity.state = ParcelStateEnum.PAYMENT_PENDING;
    parcelEntity.freeShippingReason = null;

    const createdParcel = await queryRunner.manager.save(
      ParcelEntity,
      parcelEntity,
    );

    // Create order items for all cart items in the single parcel
    for (const item of validItems) {
      const orderItem = new OrderItemEntity();
      orderItem.orderId = createdOrder.id;
      orderItem.configId = item.configId;
      orderItem.tempParcelId = createdParcel.id;
      orderItem.quantity = item.quantity;
      orderItem.isMarketplace = item.isMarketplace;
      orderItem.checkoutPrice = Utils.calculatePricePerDomainAndCategory(
        this.als.getStore()['domainName'].en,
        item.config.carPart.joinCategories[0].categoryId,
        item.config.price,
      );
      orderItem.checkoutBasePrice = Utils.calculatePricePerDomainAndCategory(
        this.als.getStore()['domainName'].en,
        item.config.carPart.joinCategories[0].categoryId,
        item.config.basePrice,
      );
      orderItem.checkoutPurchasePrice = item.config.purchasePrice;
      await queryRunner.manager.save(OrderItemEntity, orderItem);
    }

    return createdOrder;
  }

  async createPaymentForOrder(
    order: IOrder,
    userPhoneNumber: string,
    validItems: ICartItem[],
    paymentType: PaymentType,
    totalPrice: number,
    totalShippingCostAndPackingCost: number,
    discountAmount: number,
    hostname: string,
    queryRunner: QueryRunner,
  ): Promise<[string, string, TaraIpgPurchaseData | null]> {
    // Entry event (ADR-037 rule 5): the input needed to reconstruct any
    // failed gateway-create from logs, before the per-gateway switch.
    this.logger.log('payment_create_start', 'OrderService', {
      orderId: order.id,
      userId: order.userId,
      gateway: paymentType,
      operation: 'create',
      totalPrice,
      shippingAndPackingCost: totalShippingCostAndPackingCost,
      discountAmount,
      itemCount: validItems.length,
      hostname,
    });
    const payment = new PaymentEntity();
    // Populate payment fields from order details
    payment.userId = order.userId;
    payment.creatorId = order.userId;
    payment.invoiceNumber = `Invoice#${order.id}`;

    const savedPayment = await queryRunner.manager.save(PaymentEntity, payment);

    let paymentPageUrl = '';
    let transactionId = null;
    let extraInfo = ''; // add if needed
    let taraIpgPurchaseData: TaraIpgPurchaseData | null = null;

    // Installation line-items (active reserves) for the gateway cart/itemised
    // payloads. The charged amount (totalPrice) already includes installation;
    // these lines just make the gateway's item breakdown complete instead of
    // goods-only. Empty for goods-only orders.
    const installLines =
      await this.installationReserveQueryService.getInstallationCartLinesForOrder(
        order.id,
        queryRunner.manager,
      );

    let ewanoOrderId;
    switch (paymentType) {
      case PaymentType.EWANO: {
        const ewanoUser = await this.ewanoService.getEwanoUserById(
          order.userId,
        );
        const createEwanoOrderData = {
          id: String(order.id),
          discountAmount: discountAmount * 10,
          items: validItems
            .map((item) => ({
              name: item.config.carPart.name,
              quantity: item.quantity,
              unit_price: item.config.price * 10,
            }))
            // installation lines (part + service fee + gateway fee per unit)
            .concat(
              installLines.map((l) => ({
                name: l.name,
                quantity: l.count,
                unit_price: l.unitAmount * 10,
              })),
            )
            // ewano shipment in json has problem. so we send shipping emount as an item
            .concat([
              {
                name: 'هزینه ارسال',
                quantity: 1,
                unit_price: totalShippingCostAndPackingCost * 10,
              },
            ]),
          msisdn: userPhoneNumber.replace(/^0/, ''),
        };
        if (!discountAmount) {
          delete createEwanoOrderData.discountAmount;
        }
        const createEwanoOrder = await this.ewano.createOrder(
          ewanoUser.ewano.token,
          createEwanoOrderData,
        );
        // TODO: delete this log after ewano stability
        this.logger.debug('ewano_create_order_response', 'OrderService', {
          orderId: order.id,
          gateway: paymentType,
          createEwanoOrder,
        });
        this.logger.debug('ewano_create_order_status', 'OrderService', {
          orderId: order.id,
          gateway: paymentType,
          gatewayStatusCode: createEwanoOrder?.status?.code,
        });
        if (createEwanoOrder?.status?.code === 401) {
          const updateTokenResult =
            await this.ewanoService.validateRefreshToken(order.userId);
          if (updateTokenResult) {
            const createEwanoOrder = await this.ewano.createOrder(
              updateTokenResult,
              createEwanoOrderData,
            );
            if (createEwanoOrder?.status?.code === 200) {
              ewanoOrderId = createEwanoOrder.result.data?.id;
            }
          }
        } else {
          if (createEwanoOrder?.status?.code === 200) {
            ewanoOrderId = createEwanoOrder.result.data?.id;
          }
        }
        transactionId = ewanoOrderId;
        // TODO: delete this log after ewano stability
        this.logger.debug('ewano_create_order_transaction_id', 'OrderService', {
          orderId: order.id,
          gateway: paymentType,
          transactionId,
        });
        break;
      }

      case PaymentType.ITOL: {
        const itolUser = await this.itolService.getItolUserById(order.userId);
        const createItolOrderData: CreateItolOrderData = {
          // discountAmount: discountAmount * 10,
          totalAmount: totalPrice * 10,
          deliveryAmount: totalShippingCostAndPackingCost * 10,
          orderId: order.id,
          items: validItems
            .map((item) => ({
              id: item.id,
              amount: item.config.price * 10,
              name: item?.config?.carPart?.name,
              quantity: item.quantity,
            }))
            .concat(
              installLines.map((l) => ({
                id: l.id,
                amount: l.unitAmount * 10,
                name: l.name,
                quantity: l.count,
              })),
            ),
        };

        const { data } = await this.itol.itolCreateOrder(
          createItolOrderData,
          itolUser?.itol?.token,
        );

        if (!itolUser?.itol?.token) {
          throw new BadRequestException('Invalid request: missing Itol token');
        }

        if (data.amount !== totalPrice * 10) {
          throw new BadRequestException('Invalid request: Itol amount');
        }

        transactionId = data.transaction_id;
        paymentPageUrl = data.callback;
        break;
      }

      case PaymentType.ZARINPAL: {
        const [authority, pgu] = await this.payment.addPayment(
          totalPrice,
          `https://${hostname}${
            process.env.VERIFY_ORDER_PAGE_URL || '/api/order/verify'
          }`,
        );
        paymentPageUrl = pgu;
        transactionId = authority;
        break;
      }

      case PaymentType.SAMAN: {
        // Logic for SAMAN payment
        transactionId = uuidv4(); // Make sure to import uuidv4 from 'uuid'
        if (
          process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV === 'staging'
        )
          break;
        const pgu = await this.saman.addPayment(
          totalPrice * 10,
          transactionId,
          userPhoneNumber,
          `https://${hostname}${
            process.env.VERIFY_SAMAN_ORDER_PAGE_URL || '/api/order/saman-verify'
          }`,
        );
        paymentPageUrl = pgu;
        break;
      }

      case PaymentType.SNAPP_PAY: {
        const cartList = {
          cartId: order.id,
          totalAmount: totalPrice * 10,
          shippingAmount: totalShippingCostAndPackingCost * 10,
          isShipmentIncluded: true,
          isTaxIncluded: true,
          taxAmount: 0,
          cartItems: validItems.map((item) => {
            const category =
              item?.config?.carPart?.joinCategories?.length > 0
                ? item?.config?.carPart?.joinCategories[0]?.category
                : undefined;

            const getCategory = (id?: number): string => {
              switch (id) {
                case SPECIAL_CATEGORY_ID.LASTIC:
                case SPECIAL_CATEGORY_ID.LASTIC_DOLATI:
                case SPECIAL_CATEGORY_ID.LASTIC_OTHER:
                  return 'لاستیک';
                default:
                  return 'لوازم یدکی ماشین';
              }
            };

            return {
              id: item.config.id,
              amount: item.config.price * 10,
              category: getCategory(category?.id),
              commissionType: getSnappPayCommissionType(category?.altName),
              count: item.quantity,
              name: item.config.carPart.name,
            };
          }),
        };
        cartList.cartItems = cartList.cartItems.concat(
          installLines.map((l) => ({
            id: l.id,
            amount: l.unitAmount * 10,
            category: 'لوازم یدکی ماشین',
            commissionType: SnappPayCommissionType.DEFAULT,
            count: l.count,
            name: l.name,
          })),
        );
        transactionId = new Date().valueOf().toString();
        const [paymentToken, pgu] = await this.snapp.getPaymentToken(
          totalPrice * 10, // Adjust according to your needs
          transactionId,
          [cartList],
          discountAmount * 10,
          userPhoneNumber.replace(/^0/, '+98'),
        );
        paymentPageUrl = pgu;
        extraInfo = paymentToken;
        break;
      }

      case PaymentType.TOROB_PAY: {
        const cartList = {
          cartId: order.id,
          totalAmount: totalPrice * 10,
          shippingAmount: totalShippingCostAndPackingCost * 10,
          isShipmentIncluded: true,
          isTaxIncluded: true,
          taxAmount: 0,
          cartItems: validItems
            .map((item) => {
              return {
                id: item.config.id,
                amount: item.config.price * 10,
                category: 'لوازم یدکی ماشین',
                count: item.quantity,
                name: item.config.carPart.name,
              };
            })
            .concat(
              installLines.map((l) => ({
                id: l.id,
                amount: l.unitAmount * 10,
                category: 'لوازم یدکی ماشین',
                count: l.count,
                name: l.name,
              })),
            ),
        };
        transactionId = new Date().valueOf().toString();
        const [paymentToken, pgu] = await this.torob.getPaymentToken(
          totalPrice * 10, // Adjust according to your needs
          transactionId,
          [cartList],
          discountAmount * 10,
          userPhoneNumber.replace(/^0/, '+98'),
        );
        paymentPageUrl = pgu;
        extraInfo = paymentToken;
        break;
      }

      case PaymentType.TARA: {
        transactionId = uuidv4();
        const cartItemTaraList = validItems
          .map((item) => {
            return {
              name: item.config.carPart.name,
              code: item.configId,
              count: item.quantity,
              unit: 5, // document tara: 5 means number(1->kg , 2->meter, . . . 5->number, . . .)
              fee: item.config.price * 10,
            };
          })
          .concat(
            installLines.map((l) => ({
              name: l.name,
              code: l.id,
              count: l.count,
              unit: 5,
              fee: l.unitAmount * 10,
            })),
          );

        const [token, username, ipgPurchaseFormUrl] = await this.tara.getToken(
          totalPrice * 10,
          cartItemTaraList,
          userPhoneNumber,
          order.id,
          transactionId,
          totalShippingCostAndPackingCost * 10,
        );
        extraInfo = token;
        taraIpgPurchaseData = {
          username,
          token,
          ipgPurchaseFormUrl,
        };
        break;
      }

      case PaymentType.DIGI_PAY: {
        transactionId = uuidv4();

        const data: CreateOrderData = {
          amount: totalPrice * 10,
          cellNumber: userPhoneNumber,
          providerId: transactionId,

          basketDetailsDto: {
            basketId: String(validItems[0].id),
            items: validItems.map((item) => {
              return {
                brand: null,
                categoryId: null,
                count: item.quantity,
                productCode: null,
                productType: null,
                sellerId: null,
                supplierId: null,
              };
            }),
          },
        };
        const { redirectUrl, ticket } = await this.digipayService.createOrder(
          data,
        );
        paymentPageUrl = redirectUrl;
        extraInfo = ticket;
        break;
      }

      case PaymentType.AZKI: {
        const domainNameEn = String(this.als.getStore()?.domainName?.en || '');
        const pageUrlPrefix = Utils.normalizeUrlBase(
          Utils.getPageUrlPrefix(domainNameEn),
        );
        const items = validItems
          .map((item) => ({
            name: item.config.carPart.name,
            count: item.quantity,
            amount: item.config.price * 10,
          }))
          .concat(
            installLines.map((l) => ({
              name: l.name,
              count: l.count,
              amount: l.unitAmount * 10,
            })),
          );

        const itemsAndServices = [
          ...items,
          {
            name: 'هزینه خدمات',
            count: 1,
            amount: totalShippingCostAndPackingCost * 10,
          },
        ];

        const callbackUrl = `https://${hostname}/api/order/azki-verify?orderId=${order.id}`;
        const fallbackUrl = `https://${pageUrlPrefix}/checkout/callback/${order.id}`;
        try {
          const createResult = await this.azkiService.createTicket({
            amount: totalPrice * 10,
            redirect_uri: callbackUrl,
            fallback_uri: fallbackUrl,
            mobile_number: userPhoneNumber,
            items: itemsAndServices,
          });
          if (createResult.rsCode !== 0 || !createResult.result) {
            // Rethrown and captured downstream (proceedCheckout catch /
            // exception filter) — skip Sentry here to avoid double capture.
            this.logger.error(
              'azki_create_ticket_failed',
              undefined,
              'OrderService',
              {
                orderId: order.id,
                gateway: paymentType,
                operation: 'create',
                rsCode: createResult.rsCode,
                gatewayMessage: createResult.message,
                __skipSentryCapture: true,
              },
            );
            throw new BadRequestException(
              createResult.message || 'Azki payment initiation failed',
            );
          }
          transactionId = createResult.result.ticket_id;
          paymentPageUrl = createResult.result.payment_uri;
        } catch (error) {
          throw error;
        }
        break;
      }
      case PaymentType.ZARINPLUS: {
        const siteAddress = Utils.normalizeUrlBase(
          process.env.SITE_ADDRESS || `https://${hostname}`,
        );
        const domainNameEn = String(this.als.getStore()?.domainName?.en || '');
        const pageUrlPrefix = Utils.normalizeUrlBase(
          Utils.getPageUrlPrefix(domainNameEn),
        );

        const successUrl = `${siteAddress}/api/order/zarinplus-verify?orderId=${order.id}`;
        const cancelUrl = `${pageUrlPrefix}/checkout/callback${order.id}`;

        const createResult = await this.zarinPlusService.createPaymentRequest({
          amount: totalPrice * 10, //IRR
          cancel: cancelUrl,
          success: successUrl,
          item: `Order #${order.id}`,
          cellphone: userPhoneNumber,
          email: '',
        });

        transactionId = createResult.authority;
        paymentPageUrl = createResult.redirect_url;
        break;
      }

      case PaymentType.KEEPA: {
        const keepaAmount = totalPrice * 10; // Toman to Rial
        const { token, paymentUrl } = await this.keepaService.getPaymentToken({
          invoiceNumber: String(order.id),
          amount: keepaAmount,
          items: validItems
            .map((item) => ({
              itemName: item.config.carPart.name,
              itemCode: String(item.config.id),
              quantity: item.quantity,
              unitName: 'عدد',
              unitId: '1',
              unitPrice: item.config.price * 10,
              discount: 0,
              vat: 0,
              amount: item.config.price * 10,
            }))
            .concat(
              installLines.map((l) => ({
                itemName: l.name,
                itemCode: String(l.id),
                quantity: l.count,
                unitName: 'عدد',
                unitId: '1',
                unitPrice: l.unitAmount * 10,
                discount: 0,
                vat: 0,
                amount: l.unitAmount * 10,
              })),
            ),
        });
        transactionId = token;
        paymentPageUrl = paymentUrl;
        break;
      }

      case PaymentType.VIBE: {
        const vibeAmount = totalPrice * 10; // Toman to Rial
        const vibeOrderId = uuidv4();
        const vibeResult = await this.vibeService.createOrder({
          order_id: vibeOrderId,
          cart_amount: vibeAmount,
          data: {
            goods_amount: vibeAmount,
            tax: 0,
            items: validItems
              .map((item) => ({
                id: String(item.config.id),
                name: item.config.carPart.name,
                price: item.config.price * 10,
                quantity: item.quantity,
                discount: 0,
              }))
              .concat(
                installLines.map((l) => ({
                  id: String(l.id),
                  name: l.name,
                  price: l.unitAmount * 10,
                  quantity: l.count,
                  discount: 0,
                })),
              ),
          },
        });
        transactionId = vibeOrderId;
        paymentPageUrl = vibeResult.payment_url;
        break;
      }

      default:
        throw new BadRequestException('Unsupported payment type');
    }

    const paymentTransaction = new PaymentTransactionEntity();
    paymentTransaction.paymentId = savedPayment.id;
    paymentTransaction.price = totalPrice;
    paymentTransaction.paymentType = paymentType;
    paymentTransaction.portalLink = paymentPageUrl;
    paymentTransaction.portalName = paymentType; //addition
    paymentTransaction.transactionId = transactionId;
    paymentTransaction.extraInfo = extraInfo;

    await queryRunner.manager.save(
      PaymentTransactionEntity,
      paymentTransaction,
    );

    await queryRunner.manager.update(
      OrderEntity,
      { id: order.id },
      { paymentId: savedPayment.id },
    );

    // Success/failure symmetry (ADR-037 rule 10): failures surface via the
    // proceedCheckout catch / exception filter with the same ids.
    this.logger.log('payment_create_success', 'OrderService', {
      orderId: order.id,
      gateway: paymentType,
      operation: 'create',
      transactionId,
      totalPrice,
    });
    return [paymentPageUrl, transactionId, taraIpgPurchaseData];
  }

  async updateCartState(
    cartId: number,
    state: CartStateEnum,
    queryRunner: QueryRunner,
  ) {
    await queryRunner.manager.update(CartEntity, { id: cartId }, { state });
  }

  /**
   * Sum the installation PART prices (the discountable installation base) the
   * same way the cart shows them — A/B margin + per-domain category markup,
   * per unit — so it matches the FE-supplied total exactly. Excludes the
   * service fee and the gateway fee (those are not discounted). Mirrors
   * CartService.projectInstallationBookings' price logic.
   */
  private computeInstallationPartsDiscountBase(
    bookings: InstallationBookingEntity[],
    domainNameEn: string,
    abTestVariants?: AbTestVariants,
  ): number {
    let total = 0;
    for (const booking of bookings) {
      for (const item of booking.items ?? []) {
        const config = item.carPartConfig;
        const categoryId = config?.carPart?.joinCategories?.[0]?.category?.id;
        let price = Utils.roundPrice(config?.price ?? 0, 3);
        if (categoryId != null) {
          const pricingCfg = this.abTestService.getPricingConfig(
            config.id,
            categoryId,
            abTestVariants,
          );
          price = Utils.adjustCartPrice(
            config.price ?? 0,
            pricingCfg?.marginMultiplier ?? null,
            domainNameEn,
            categoryId,
          );
        }
        total += price * item.quantity;
      }
    }
    return total;
  }

  async calculateDiscountAndShippingCostAndAdjustTotal(
    order: IOrder,
    totalPrice: number,
    discount: IDiscount,
    shippingCost: number,
    packingCost: number,
    cartTotalFeeAmount: number,
    queryRunner: QueryRunner,
    // Installation folded into the SAME order-level discount the goods pay (the
    // discount is order-wide, not goods-only):
    //  - installationItemsTotalPrice: the installation PART price (ex gateway
    //    fee, ex service fee, A/B applied) — joins the goods total in the
    //    discountable base for a non-DELIVERY discount, exactly like goods.
    //  - installationFeeTotal: install service fee + install gateway fee —
    //    added AFTER discount, undiscounted, exactly like the goods gateway fee.
    // Both default 0 so a goods-only order is unaffected.
    installationItemsTotalPrice = 0,
    installationFeeTotal = 0,
  ) {
    let discountAmount = 0;
    // The discountable base spans the whole order's item value: goods items +
    // installation parts. Fees/shipping/packing are added after (undiscounted).
    const discountableBase = totalPrice + installationItemsTotalPrice;
    let discountedTotalPrice = discountableBase;
    if (discount) {
      if (discount.type === DiscountType.DELIVERY) {
        // DELIVERY discount applies to shipping cost only — never to goods or
        // installation. (packing cost is excluded too.)
        if (discount.amountType === 'AMOUNT') {
          discountAmount = Math.min(discount.amount, shippingCost);
          discountedTotalPrice -= discountAmount;
        } else if (discount.amountType === 'PERCENT') {
          const discountAmountPercent = (discount.amount * shippingCost) / 100;
          discountAmount = Math.min(discountAmountPercent, shippingCost);
          discountedTotalPrice -= discountAmount;
        }
      } else {
        // Order-wide discount → applies to the goods + installation base.
        if (discount.amountType === 'AMOUNT') {
          discountAmount = discount.amount;
          discountedTotalPrice -= discount.amount;
        } else if (discount.amountType === 'PERCENT') {
          discountAmount = (discount.amount * discountableBase) / 100;
          discountedTotalPrice *= (100 - discount.amount) / 100;
        }
      }
    }

    // Add shipping cost (after discount) and packing cost (no discount)
    const discountedCartItemsTotalPriceWithOperationCost =
      discountedTotalPrice + shippingCost + packingCost;

    // Gateway fees (goods + installation) and the install service fee are added
    // last and are never discounted.
    let finalTotalPrice =
      discountedCartItemsTotalPriceWithOperationCost +
      cartTotalFeeAmount +
      installationFeeTotal;

    // Ensure total never goes negative
    if (finalTotalPrice < 0) {
      finalTotalPrice = 0;
    }

    await queryRunner.manager.update(
      OrderEntity,
      { id: order.id },
      {
        totalPrice: finalTotalPrice,
        discountAmount: discountAmount,
      },
    );
    return {
      finalTotalPrice,
      discountAmount,
    };
  }

  /**
   * Shared AMPC stock reduction for a VERIFIED order — used by BOTH the goods
   * path (`reduceConfigQuantities`) and the installation path
   * (`decrementReservePartStock`). Goods and installation still reduce
   * separately (their own call), but funnel through this one method so the
   * batching + low-stock alert live in a single place, and everything
   * ultimately calls `carPartService.updateStockWithManager`.
   *
   * Batching: aggregate quantities per (config, channel) first — the same
   * config can appear in several lines (a goods order creates one row per unit;
   * a reserve can repeat a config) — then group those by (channel, quantity) so
   * configs sharing both go through a SINGLE updateStockWithManager call (that
   * method bakes one quantity into its SQL and applies it to a list of ids).
   * For the common all-quantity-1 case this collapses to ~2 calls (one per
   * channel) instead of one per item.
   *
   * Low-stock alert: one batched fetch of all affected configs, then a Telegram
   * alert per config whose post-decrement available stock is <= 5.
   */
  async reduceAmpcStockForVerifiedItems(
    lines: { configId: number; quantity: number; isMarketplace: boolean }[],
    manager: EntityManager,
  ): Promise<void> {
    if (!lines.length) return;

    // 1) Aggregate per (config, channel).
    const aggByKey = new Map<
      string,
      { configId: number; isMarketplace: boolean; quantity: number }
    >();
    for (const line of lines) {
      const key = `${line.configId}:${line.isMarketplace}`;
      const existing = aggByKey.get(key);
      if (existing) existing.quantity += line.quantity;
      else
        aggByKey.set(key, {
          configId: line.configId,
          isMarketplace: line.isMarketplace,
          quantity: line.quantity,
        });
    }
    const aggregated = [...aggByKey.values()];

    // 2) Batch-fetch the affected configs once (for the low-stock alert).
    const configIds = [...new Set(aggregated.map((a) => a.configId))];
    const configs = await manager.find(CarPartConfigEntity, {
      where: { id: In(configIds) },
      select: {
        id: true,
        sellerStock: true,
        warehouseAvailableStock: true,
        sellerAvailableStock: true,
        warehousePhysicalStock: true,
        storedStock: true,
        commercialReserve: true,
        soldWarehouseReserve: true,
        purchaseStock: true,
        purchasePrice: true,
        sellState: true,
        collectPeriod: true,
        price: true,
        basePrice: true,
        isScrap: true,
        supplier: { title: true },
        carPart: { id: true, name: true },
      },
      relations: ['carPart', 'supplier'],
    });
    const configMap = new Map(configs.map((c) => [c.id, c]));

    // 3) Group by (channel, quantity) so identical-quantity configs of the same
    //    channel share ONE updateStockWithManager call.
    const groups = new Map<
      string,
      { isMarketplace: boolean; quantity: number; ids: number[] }
    >();
    for (const a of aggregated) {
      const key = `${a.isMarketplace}:${a.quantity}`;
      const group = groups.get(key);
      if (group) group.ids.push(a.configId);
      else
        groups.set(key, {
          isMarketplace: a.isMarketplace,
          quantity: a.quantity,
          ids: [a.configId],
        });
    }
    for (const group of groups.values()) {
      const action = group.isMarketplace
        ? StockAction.VERIFY_ORDER_MARKETPLACE_ITEM
        : StockAction.VERIFY_ORDER_RETAIL_ITEM;
      await this.carPartService.updateStockWithManager(
        group.ids,
        action,
        group.quantity,
        manager,
      );
    }

    // 4) Low-stock alert per affected config (goods AND installation).
    for (const a of aggregated) {
      const carPartConfig = configMap.get(a.configId);
      if (!carPartConfig) continue;
      const newCapacity =
        (a.isMarketplace
          ? carPartConfig.sellerAvailableStock
          : carPartConfig.warehouseAvailableStock) - a.quantity;
      if (newCapacity <= 5) {
        this.messagingService.sendTelegram(
          `amp: ${carPartConfig.carPart?.id}\n` +
            `ampc: ${carPartConfig.id}\n` +
            `name: ${carPartConfig.carPart?.name}\n` +
            `sellerStock: ${carPartConfig.sellerStock}\n` +
            `warehouseAvailableStock: ${carPartConfig.warehouseAvailableStock}\n` +
            `sellerAvailableStock: ${carPartConfig.sellerAvailableStock}\n` +
            `warehousePhysicalStock: ${carPartConfig.warehousePhysicalStock}\n` +
            `storedStock: ${carPartConfig.storedStock}\n` +
            `commercialReserve: ${carPartConfig.commercialReserve}\n` +
            `soldWarehouseReserve: ${carPartConfig.soldWarehouseReserve}\n` +
            `purchaseStock: ${carPartConfig.purchaseStock}\n` +
            `purchasePrice: ${carPartConfig.purchasePrice}\n` +
            `sellState: ${carPartConfig.sellState}\n` +
            `collectPeriod: ${carPartConfig.collectPeriod}\n` +
            `price: ${carPartConfig.price}\n` +
            `basePrice: ${carPartConfig.basePrice}\n` +
            `isScrap: ${carPartConfig.isScrap}\n` +
            `supplier: ${carPartConfig.supplier?.title}\n`,
          '-1002492350170',
        );
      }
    }
  }

  /**
   * Goods path: reduce AMPC stock for a verified order's goods items.
   * Thin wrapper over the shared `reduceAmpcStockForVerifiedItems`.
   */
  async reduceConfigQuantities(
    cartItems: CartItemEntity[] | OrderItemEntity[],
    queryRunner: QueryRunner,
  ): Promise<void> {
    await this.reduceAmpcStockForVerifiedItems(
      cartItems.map((item) => ({
        configId: item.configId,
        quantity: item.quantity,
        isMarketplace: item.isMarketplace,
      })),
      queryRunner.manager,
    );
  }

  /**
   * Decrement AMPC stock for the parts SUPPLIED through an installation reserve
   * (state "supply + install"). Called from
   * `ReserveCheckoutService.confirmReservesAfterPayment` after payment
   * verifies — the install reserve consumes AMPC stock exactly like a goods
   * order item does (VERIFY_ORDER_* actions), keyed off the channel snapshot
   * frozen on the reserve item at checkout.
   */
  async decrementReservePartStock(
    items: {
      carPartConfigId: number;
      quantity: number;
      isMarketplace: boolean;
    }[],
    manager: EntityManager,
  ): Promise<void> {
    // Installation path: same shared bulk reducer as goods (verify-order stock +
    // low-stock alert), just with the reserve-item shape mapped in.
    await this.reduceAmpcStockForVerifiedItems(
      items.map((it) => ({
        configId: it.carPartConfigId,
        quantity: it.quantity,
        isMarketplace: it.isMarketplace,
      })),
      manager,
    );
  }

  /**
   * Restore AMPC stock for an installation reserve's supplied parts on
   * cancellation — the exact inverse of {@link decrementReservePartStock}.
   * Uses the channel snapshot (`isMarketplace`) frozen at checkout so the
   * restore hits the SAME bucket the decrement touched, regardless of how live
   * stock has shifted since.
   */
  async restoreReservePartStock(
    items: {
      carPartConfigId: number;
      quantity: number;
      isMarketplace: boolean;
    }[],
    manager: EntityManager,
  ): Promise<void> {
    for (const it of items) {
      const action = it.isMarketplace
        ? StockAction.RESERVE_CANCEL_MARKETPLACE_ITEM
        : StockAction.RESERVE_CANCEL_RETAIL_ITEM;
      await this.carPartService.updateStockWithManager(
        [it.carPartConfigId],
        action,
        it.quantity,
        manager,
      );
    }
  }

  /**
   * Whether an order still has any NON-cancelled goods.
   *
   * Used by the installation refund flow to decide if cancelling a reserve
   * leaves the whole order cancelled (full reverse) or partial. Delegates to the
   * existing item-level `isWholeOrderParcelsCancelled` (checks PhysicalOrderItem
   * isCancelled, not just parcel.state) so an edge case — a parcel left in a
   * non-cancelled state while all its items are cancelled — is judged correctly.
   */
  async orderHasActiveGoods(
    orderId: number,
    queryRunner: QueryRunner,
  ): Promise<boolean> {
    return !(await this.physicalItemService.isWholeOrderParcelsCancelled(
      orderId,
      queryRunner,
    ));
  }

  /**
   * Whether the order has any CANCELLED parcel whose shipping/packing cost was
   * deliberately KEPT (not refunded — `isShippingCostRefunded=false`). Such cost
   * still sits in `order.totalPrice`.
   *
   * The installation refund flow uses this to avoid the same over-refund the
   * goods flow guards against: a "full" reserve cancel reverses
   * `order.totalPrice`, which would also refund this retained shipping. When it
   * returns true, refundReserveShare takes the PARTIAL path (refund only the
   * reserve's share), leaving the retained shipping kept.
   */
  async orderHasRetainedShippingCost(
    orderId: number,
    queryRunner: QueryRunner,
  ): Promise<boolean> {
    // Whole-order check (no parcel excluded). Delegates to PhysicalItemService —
    // the single owner of the parcel query — same as orderHasActiveGoods.
    return this.physicalItemService.hasCancelledParcelsWithNonRefundedShipping(
      orderId,
      queryRunner,
    );
  }

  async sendOrderNotification(
    order: IOrder,
    totalPrice: number,
    validItems: ICartItem[],
    addressDescription: string,
    user: IUser,
    paymentType: PaymentType,
  ) {
    try {
      this.messagingService.sendTelegram(
        `درگاه جدید\n` +
          `نوع درگاه: ${
            paymentType === PaymentType.ZARINPAL
              ? '🟡 ZARINPAL'
              : paymentType === PaymentType.SAMAN
              ? '🔵 SAMAN'
              : '🟢 SNAPPPAY'
          }\n` +
          `کاربر: ${user?.firstName} ${user?.lastName} ${user?.phoneNumber}\n ` +
          `مبلغ: ${totalPrice}\n` +
          `تعداد کالا: ${validItems.length || 'نامشخص'}\n` +
          // `شماره پیگیری: ${order.traceNumber}\n` +
          // `آی دی ترنزکشن: ${order.transactionId}\n` +
          `آدرس: ${addressDescription}\n` +
          `کالاها:\n` +
          `${validItems.map((item) => {
            return `${item.config.carPart.id} - ${item.config.carPart.name} - ${item.config.price} تومان - تعداد:${item.quantity}\n`;
          })}`,
        '-1001741599014',
      );
    } catch (e) {
      // Swallowed (telegram notify failure must not fail checkout) —
      // logger.error is the single Sentry capture.
      this.logger.error(
        'order_notification_telegram_failed',
        toError(e),
        'OrderService',
        { orderId: order.id, userId: order.userId },
      );
    }
  }

  async canShipConfigToCity(
    config: CarPartConfigEntity,
    cityId: number,
    provinceId: number,
  ): Promise<boolean> {
    const orderShippings = await this.orderShippingRepo.find({
      where: {
        supplierUserId:
          config.deliveryMethod === DeliveryMethod.SHIPBY_AUTOMOBY
            ? IsNull()
            : config.supplierUserId,
        size: config.carPart.size,
      },
    });

    const hasShipping = orderShippings.some(
      (shipping) =>
        (shipping.cityId === cityId && shipping.provinceId === provinceId) ||
        (shipping.provinceId === provinceId &&
          shipping.cityId === Utils.otherCities) ||
        (shipping.provinceId === Utils.otherProvinces &&
          shipping.cityId === Utils.otherCities),
    );

    // If no shipping available, return false
    if (!hasShipping) {
      return false;
    }

    // For scrap items, check if the city is in supplier's scrap cities
    if (config.isScrap && config.supplierUserId) {
      const { SupplierScrapCityEntity } = await import(
        'src/supplier/entities/supplier-scrap-city.entity'
      );
      const { SupplierEntity } = await import(
        'src/supplier/entities/supplier.entity'
      );

      // Single optimized query with JOIN
      const scrapCity = await this.dataSource
        .getRepository(SupplierScrapCityEntity)
        .createQueryBuilder('scrapCity')
        .innerJoin(
          SupplierEntity,
          'supplier',
          'supplier.id = scrapCity.supplierId',
        )
        .where('supplier.userId = :supplierUserId', {
          supplierUserId: config.supplierUserId,
        })
        .andWhere('scrapCity.cityId = :cityId', { cityId })
        .getOne();

      return !!scrapCity;
    }

    return hasShipping;
  }

  async validateParcel(
    cart: CartEntity,
    cityId: number,
    provinceId: number,
    inputParcels: ParcelShippingDto[],
    abTestVariants?: AbTestVariants,
  ): Promise<ParcelWithShippingType[]> {
    this.logger.debug('checkout_parcel_validate', 'OrderService', {
      cartId: cart.id,
      cityId,
      provinceId,
      parcelCount: inputParcels.length,
    });
    const res: ParcelWithShippingType[] = [];
    const parcels = await this.getAvailableShippingCosts(
      cart,
      cityId,
      provinceId,
      abTestVariants,
    );
    if (!parcels) {
      // Validation failures → warn (rule 12); statusCode 400 suppresses the
      // Sentry warning capture inside LoggerService.warn.
      this.logger.warn('checkout_parcel_validation_failed', 'OrderService', {
        cartId: cart.id,
        reason: 'invalid-parcel-cart',
        statusCode: 400,
      });
      throw new BadRequestException('invalid-parcel-cart');
    }
    // check inputParcels and parcels length
    if (inputParcels.length !== parcels.length) {
      this.logger.warn('checkout_parcel_validation_failed', 'OrderService', {
        cartId: cart.id,
        reason: 'invalid-parcel-length',
        expectedCount: parcels.length,
        receivedCount: inputParcels.length,
        statusCode: 400,
      });
      throw new BadRequestException('invalid-parcel-length');
    }

    // check inputParcels and parcels content base on row attribute
    for (const inputParcel of inputParcels) {
      const parcel = parcels.find((p) => p.row === inputParcel.row);
      if (!parcel) {
        this.logger.warn('checkout_parcel_validation_failed', 'OrderService', {
          cartId: cart.id,
          reason: 'invalid-parcel-row',
          row: inputParcel.row,
          statusCode: 400,
        });
        throw new BadRequestException('invalid-parcel-row');
      }
      // check parcel.parcel array and inputParcel.items array be exacly same
      if (
        inputParcel.items.length !== parcel.parcel.length ||
        !inputParcel.items.every((item) =>
          parcel.parcel.some(
            (pItem) =>
              pItem.configId === item.configId &&
              pItem.quantity === item.quantity,
          ),
        )
      ) {
        this.logger.warn('checkout_parcel_validation_failed', 'OrderService', {
          cartId: cart.id,
          reason: 'invalid-parcel-items',
          row: inputParcel.row,
          statusCode: 400,
        });
        throw new BadRequestException('invalid-parcel-items');
      }
      // find shippingType in parcel.shippingTypes
      const shippingType = parcel.shippingTypes.find(
        (type) => type.shippingType === inputParcel.shippingType,
      );
      if (!shippingType) {
        this.logger.warn('checkout_parcel_validation_failed', 'OrderService', {
          cartId: cart.id,
          reason: 'invalid-parcel-shipping-type',
          row: inputParcel.row,
          shippingType: inputParcel.shippingType,
          statusCode: 400,
        });
        throw new BadRequestException('invalid-parcel-shipping-type');
      }
      // validate proccess date
      if (
        !Utils.isSameDate(shippingType.processDate, inputParcel.processDate)
      ) {
        this.logger.warn('checkout_parcel_validation_failed', 'OrderService', {
          cartId: cart.id,
          reason: 'invalid-parcel-process-date',
          row: inputParcel.row,
          receivedDate: inputParcel.processDate,
          expectedDate: shippingType.processDate,
          statusCode: 400,
        });
        throw new BadRequestException(
          `تاریخ پردازش مرسوله معتبر نیست. تاریخ دریافتی: ${inputParcel.processDate}، تاریخ مورد انتظار: ${shippingType.processDate}`,
        );
      }
      res.push({
        shippingType: shippingType,
        parcel: parcel.parcel,
      });
    }
    return res;
  }

  async proceedCheckout(
    userId: number,
    dto: CreateOrderDto,
    hostname: string,
    res: Response,
    abTestVariants?: AbTestVariants,
  ) {
    const user = await this.userService.getUserById(userId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let order: OrderEntity | null = null;
    try {
      // Fetch active cart first — we need to know whether there are goods
      // before deciding if a delivery address is required.
      const cart = await this.cartService.getActiveCart(userId, queryRunner);

      // Forensics (ADR-037): checkout entry event with the request essentials
      // — the input data needed to reconstruct any failed checkout from logs.
      this.logger.log('checkout_start', 'OrderService', {
        userId,
        cartId: cart.id,
        gateway: dto.paymentType,
        addressId: dto.addressId,
        hasDiscountCode: Boolean(dto.discountCode),
        hostname,
      });

      // Validate the cart's installation bookings against current AMPT/AMP/AMPC
      // state, the in-city guard, stock, technician activity and the lead-time
      // floor (the cart may have aged). The effective city mirrors cart-add
      // (currentCityId, Tehran fallback). Returns fully-loaded bookings for
      // reserve creation below.
      const effectiveCityId = user.currentCityId ?? CITY_Id.TEHRAN;
      const validatedBookings =
        await this.installationCheckoutService.validateBookingsForCheckout(
          cart.id,
          effectiveCityId,
          queryRunner,
        );
      // Checkout checkpoint (ADR-037): bookings passed validation.
      this.logger.log('checkout_bookings_validated', 'OrderService', {
        userId,
        cartId: cart.id,
        bookingCount: validatedBookings.length,
      });

      // Goods presence decides the address requirement. Installation happens at
      // the technician's location (live-read from the reserve, ADR-008), so an
      // install-only cart (OI-4 case C) needs no delivery address →
      // addressClone stays null.
      const hasGoods = (cart.items?.length ?? 0) > 0;

      let address: AddressCloneEntity | null = null;
      let cityId: number | undefined;
      let provinceId: number | undefined;
      let validItems: CartItemEntity[] = [];

      if (hasGoods) {
        address = await this.validateAndGetAddress(dto, userId, queryRunner);
        ({ cityId, provinceId } =
          await this.addressService.getCityAndProvinceId(
            address.city,
            address.province,
          ));
        validItems = await this.cartService.validateCartItems(
          cart.id,
          userId,
          address.city,
          cityId,
          provinceId,
          dto.paymentType,
        );
      }

      // Checkout checkpoint: goods items validated (0 for install-only carts).
      this.logger.log('checkout_items_validated', 'OrderService', {
        userId,
        cartId: cart.id,
        itemCount: validItems.length,
        hasGoods,
      });

      // OI-4 option 1: an install-only cart (goods empty, bookings present) is
      // a valid checkout. Empty means neither goods nor installation.
      if (validItems.length === 0 && validatedBookings.length === 0) {
        throw new BadRequestException('empty-cart');
      }

      // Parcels are built from goods only. An install-only cart has none.
      // `dto.parcels` is now optional (OI-4); default to [] so a goods cart that
      // omits it gets a clean 'invalid-parcel-length' instead of a 500 on
      // undefined.length.
      const parcels =
        validItems.length > 0
          ? await this.validateParcel(
              cart,
              cityId,
              provinceId,
              dto.parcels ?? [],
              abTestVariants,
            )
          : [];

      // Calculate total price including shipping and apply discount
      const { cartItemsTotalPrice, cartItemsTotalPriceWithFee } =
        await this.cartService.calculateCartItemsTotalPrice(
          validItems,
          dto.paymentType,
          abTestVariants,
        );

      const cartTotalFeeAmount =
        cartItemsTotalPriceWithFee - cartItemsTotalPrice;

      const discount = await this.discountService.validateDiscount(
        dto.discountCode,
        dto.paymentType,
        cartItemsTotalPriceWithFee,
        userId,
      );
      // Checkout checkpoint: discount resolved (id only — never the code).
      this.logger.log('checkout_discount_validated', 'OrderService', {
        userId,
        cartId: cart.id,
        hasDiscount: Boolean(discount),
        discountId: discount?.id,
      });

      // temporary disable
      // Cancel other active order for user
      // await this.cancelOtherActiveOrders(userId, queryRunner);

      // Create Order and OrderItems from Cart
      order = await this.createOrderFromCart(
        userId,
        validItems,
        parcels,
        dto.paymentType,
        address,
        discount,
        cartItemsTotalPriceWithFee,
        dto.tatoken,
        user.utm,
        queryRunner,
        abTestVariants,
      );
      // Checkout checkpoint: order row exists — orderId known from here on.
      this.logger.log('checkout_order_created', 'OrderService', {
        orderId: order.id,
        userId,
        cartId: cart.id,
        gateway: dto.paymentType,
        itemCount: validItems.length,
        parcelCount: parcels.length,
      });

      // Create installation reserves (state PAYMENT_PENDING_INSTALLATION) from
      // the validated bookings, inside this transaction. Inventory is NOT
      // decremented here — that happens in verifyOrder once payment confirms
      // (decision α-3, _design §0).
      const reserves =
        await this.installationCheckoutService.createReservesFromBookings(
          validatedBookings,
          order,
          dto.paymentType,
          order.domainNameEn,
          queryRunner,
        );
      // Checkout checkpoint: installation reserves created (0 = goods-only).
      this.logger.log('checkout_reserves_created', 'OrderService', {
        orderId: order.id,
        cartId: cart.id,
        reserveCount: reserves.length,
      });
      const installationTotals =
        this.installationReserveQueryService.sumInstallationTotals(reserves);

      const shippingDiscountPercent = await this.getShippingDiscountPercent(
        dto.paymentType,
      );

      // Calculate shipping cost and packing cost separately
      // Discount should only apply to shipping cost, not packing cost
      const totalShippingCost = parcels.reduce(
        (total, parcel) =>
          total +
          this.calculateDiscountedShippingCost(
            parcel.shippingType.price,
            shippingDiscountPercent,
          ),
        0,
      );

      const totalPackingCost = parcels.reduce(
        (total, parcel) => total + (parcel.shippingType.packingCost || 0),
        0,
      );

      const totalShippingAndPackingCost = totalShippingCost + totalPackingCost;

      // Installation folds into the SAME order-level discount as goods. Split it
      // the way the discount treats it:
      //  - parts (A/B applied, ex fees) join the discountable base, like goods;
      //  - service fee + gateway fee are added after, undiscounted, like the
      //    goods gateway fee.
      // The parts base is computed the same way the cart shows it (A/B +
      // per-domain) so it matches the FE-supplied total exactly.
      const installationItemsTotalPrice =
        this.computeInstallationPartsDiscountBase(
          validatedBookings,
          order.domainNameEn,
          abTestVariants,
        );
      const installationFeeTotal =
        installationTotals.serviceFeeTotal + installationTotals.feeTotal;

      const { finalTotalPrice, discountAmount } =
        await this.calculateDiscountAndShippingCostAndAdjustTotal(
          order,
          cartItemsTotalPrice,
          discount,
          totalShippingCost,
          totalPackingCost,
          cartTotalFeeAmount,
          queryRunner,
          installationItemsTotalPrice,
          installationFeeTotal,
        );

      OrderUtils.validateTotalPriceAgainstDto(finalTotalPrice, dto.totalPrice, {
        cartTotal: cartItemsTotalPriceWithFee,
        shippingCost: totalShippingCost,
        packingCost: totalPackingCost,
        discountAmount: discountAmount,
      });

      // If total is 0, process order as verified without going to gateway
      if (finalTotalPrice === 0) {
        // Create payment and payment transaction with SUCCESS state
        const payment = new PaymentEntity();
        payment.userId = order.userId;
        payment.creatorId = order.userId;
        payment.invoiceNumber = `Invoice#${order.id}`;
        const savedPayment = await queryRunner.manager.save(
          PaymentEntity,
          payment,
        );

        const transactionId = uuidv4();
        const paymentTransaction = new PaymentTransactionEntity();
        paymentTransaction.paymentId = savedPayment.id;
        paymentTransaction.price = 0;
        paymentTransaction.paymentType = dto.paymentType;
        paymentTransaction.transactionId = transactionId;
        paymentTransaction.state = PaymentTransactionState.SUCCESS;
        await queryRunner.manager.save(
          PaymentTransactionEntity,
          paymentTransaction,
        );

        await queryRunner.manager.update(
          OrderEntity,
          { id: order.id },
          { paymentId: savedPayment.id },
        );

        await queryRunner.manager.update(
          CartEntity,
          { id: cart.id },
          { showUpdatedAlert: false },
        );

        // Create mock request to simulate gateway callback
        const mockReq = {
          body: {
            ResNum: transactionId,
            transactionId: transactionId,
            additionalData: transactionId,
            orderId: order.id,
            skipThirdparty: true,
          },
          query: {
            Authority: transactionId,
          },
        } as unknown as Request;

        // Zero-amount order: skips the gateway entirely (money-path decision).
        this.logger.log('checkout_zero_amount_order', 'OrderService', {
          orderId: order.id,
          userId,
          cartId: cart.id,
          gateway: dto.paymentType,
          transactionId,
        });

        // Call verifyOrder directly - it will handle everything (processing, commit, redirect)
        // This simulates what happens when gateway calls verifyOrder after payment
        return await this.verifyOrder(
          mockReq,
          res, // Real response for redirect
          dto.paymentType,
          userId,
          queryRunner, // Pass existing queryRunner
        );
      }

      // Create payment and get payment URL (normal flow)
      const [paymentPageUrl, transactionId, taraIpgPurchaseData] =
        await this.createPaymentForOrder(
          order,
          user.phoneNumber,
          validItems,
          dto.paymentType,
          finalTotalPrice,
          totalShippingAndPackingCost,
          discountAmount,
          hostname,
          queryRunner,
        );
      // Checkout checkpoint: gateway create succeeded, payment row saved.
      this.logger.log('checkout_payment_created', 'OrderService', {
        orderId: order.id,
        cartId: cart.id,
        gateway: dto.paymentType,
        transactionId,
      });

      // await this.updateCartState(
      //   cart.id,
      //   CartStateEnum.CHECKEDOUT,
      //   queryRunner,
      // );
      await queryRunner.manager.update(
        CartEntity,
        { id: cart.id },
        { showUpdatedAlert: false },
      );

      await queryRunner.commitTransaction();

      // Funnel: the order (and its payment/gateway create) is now durably
      // committed — this is the trustworthy "payment initiated" moment
      // (emitting earlier, pre-commit, counted orders that later rolled back).
      checkoutFunnelTotal.inc({
        domain: order.domainNameEn ?? 'unknown',
        stage: 'payment_initiated',
        order_type: 'delivery',
      });

      this.sendOrderNotification(
        order,
        finalTotalPrice,
        validItems,
        // install-only orders have no delivery address (OI-4 case C)
        address?.description ?? '',
        user,
        dto.paymentType,
      );

      if (
        (process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV === 'staging') &&
        dto.paymentType !== PaymentType.ITOL &&
        dto.paymentType !== PaymentType.AZKI &&
        dto.paymentType !== PaymentType.ZARINPLUS &&
        dto.paymentType !== PaymentType.KEEPA &&
        // VIBE has no SAMAN-style staging short-circuit, so the SAMAN auto-verify
        // below cannot find its transaction (lookup filters by paymentType) and would
        // throw after commit. Exclude it and test via the real Vibe staging callback.
        dto.paymentType !== PaymentType.VIBE &&
        dto.paymentType !== PaymentType.SNAPP_PAY
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await this.verifyOrder(
          {
            body: {
              ResNum: transactionId,
              transactionId: transactionId,
              additionalData: 'someData',
              orderId: order.id,
            },
            query: {
              Authority: 'authority123',
            },
          } as unknown as Request,
          {} as Response,
          PaymentType.SAMAN,
          userId,
        );
      }

      if (!taraIpgPurchaseData) {
        res.status(200).json({
          success: true,
          url: paymentPageUrl,
          ewanoOrderId: transactionId || '',
          itolTransactionId: transactionId || '',
          // transactionId: transactionId || '',
          orderId: order.id,
        });
        return;
      }

      res.status(200).json({
        success: true,
        url: taraIpgPurchaseData.ipgPurchaseFormUrl,
        token: taraIpgPurchaseData.token,
        username: taraIpgPurchaseData.username,
      });
      return;
    } catch (err) {
      await queryRunner.rollbackTransaction();

      // Log here because we're returning response instead of throwing - exception won't reach AllExceptionsFilter
      // Sentry capture happens exactly once, in the withScope below —
      // __skipSentryCapture prevents a duplicate from this log (rule 8).
      this.logger.error('checkout_failed', toError(err), 'OrderService', {
        userId,
        orderId: order?.id,
        gateway: dto.paymentType,
        totalPrice: dto.totalPrice,
        __skipSentryCapture: true,
      });

      // ارسال خطا به Sentry با context کامل
      Sentry.withScope((scope) => {
        scope.setTag('function', 'proceedCheckout');
        scope.setTag('error_type', 'checkout_error');
        scope.setContext('checkout_details', {
          userId,
          orderId: order?.id,
          paymentType: dto.paymentType,
          discountCode: dto.discountCode,
          totalPrice: dto.totalPrice,
        });
        scope.setLevel('error');
        Sentry.captureException(err);
      });

      if (!res.headersSent) {
        res.status(err.status || 500).json({
          success: false,
          message: err.message || 'Internal server error',
        });
      }

      return;
    } finally {
      await queryRunner.release();
    }
  }

  async proceedCheckoutPickupInStore(
    userId: number,
    dto: CreateOrderPickupInStoreDto,
    hostname: string,
  ) {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new BadRequestException('user-not-found');
    }

    const supplier = await this.supplierService.getSupplierByUserId(
      dto.inStoreSupplierUserId,
    );

    if (!supplier) {
      throw new BadRequestException('supplier-not-found');
    }

    const supplierShopAddress = supplier.supplierShopAddress;

    const cart = await this.cartService.getActiveCart(
      userId,
      undefined,
      dto.inStoreSupplierUserId,
    );

    // Entry event (ADR-037 rule 5): pickup-in-store checkout input essentials.
    this.logger.log('checkout_pickup_start', 'OrderService', {
      userId,
      cartId: cart.id,
      gateway: dto.paymentType,
      inStoreSupplierUserId: dto.inStoreSupplierUserId,
      hasDiscountCode: Boolean(dto.discountCode),
      hostname,
    });

    // Validate cart items for pickup in store (no city/province validation needed)
    const validItems = await this.cartService.validateCartItemsForPickupInStore(
      cart.id,
      userId,
      dto.paymentType,
    );

    if (validItems.length === 0) {
      throw new BadRequestException('empty-cart');
    }
    // Delete payment type from here
    const totalPrice =
      await this.cartService.calculateTotalPriceFromItemsPickupInStore(
        validItems,
        dto.paymentType,
      );

    const discount = await this.discountService.validateDiscount(
      dto.discountCode,
      dto.paymentType,
      totalPrice,
      userId,
    );

    const { finalPrice: calculatedTotalPrice, discountAmount } =
      this.calculateFinalPriceWithDiscount(totalPrice, discount);

    OrderUtils.validateTotalPriceAgainstDto(
      calculatedTotalPrice,
      dto.totalPrice,
      {
        cartTotal: totalPrice,
        discountAmount: discountAmount,
      },
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.createOrderFromCartPickupInStore(
        userId,
        validItems,
        dto.paymentType,
        dto.inStoreSupplierUserId,
        supplierShopAddress,
        discount,
        calculatedTotalPrice,
        discountAmount,
        user.utm,
        queryRunner,
      );

      // Create payment and get payment URL
      const [paymentPageUrl, transactionId, taraIpgPurchaseData] =
        await this.createPaymentForOrder(
          order,
          user.phoneNumber,
          validItems,
          dto.paymentType,
          calculatedTotalPrice,
          0, // No shipping cost for pickup in store
          discountAmount,
          hostname,
          queryRunner,
        );

      // Update cart to hide alert
      await queryRunner.manager.update(
        CartEntity,
        { id: cart.id },
        { showUpdatedAlert: false },
      );

      await queryRunner.commitTransaction();

      // Funnel: order durably committed — trustworthy payment_initiated
      // moment for the pickup-in-store path (see delivery path note).
      checkoutFunnelTotal.inc({
        domain: order.domainNameEn ?? 'unknown',
        stage: 'payment_initiated',
        order_type: 'pickup',
      });

      try {
        this.sendOrderNotification(
          order,
          calculatedTotalPrice,
          validItems,
          supplierShopAddress, // Use supplier shop address instead of delivery address
          user,
          dto.paymentType,
        );
      } catch (error) {
        // Swallowed (notification failure must not fail the checkout) —
        // logger.error is the single Sentry capture; the extra
        // captureException was a duplicate (ADR-037 rule 8).
        this.logger.error(
          'order_notification_failed',
          toError(error),
          'OrderService',
          { orderId: order.id, userId },
        );
      }

      if (
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'staging'
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await this.verifyOrder(
          {
            body: {
              ResNum: transactionId,
              transactionId: transactionId,
              additionalData: 'someData',
              orderId: order.id,
            },
            query: {
              Authority: 'authority123',
            },
          } as unknown as Request,
          {} as Response,
          PaymentType.SAMAN,
          userId,
        );
      }
      // Return payment response based on payment type
      if (!taraIpgPurchaseData) {
        return {
          success: true,
          url: paymentPageUrl,
          ewanoOrderId: transactionId || '',
          itolTransactionId: transactionId || '',
          orderId: order.id,
        };
      }

      return {
        success: true,
        url: taraIpgPurchaseData.ipgPurchaseFormUrl,
        token: taraIpgPurchaseData.token,
        username: taraIpgPurchaseData.username,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  calculateFinalPriceWithDiscount(
    totalPrice: number,
    discount: IDiscount | null,
  ): { finalPrice: number; discountAmount: number } {
    if (!discount) {
      return { finalPrice: totalPrice, discountAmount: 0 };
    }

    let discountAmount = 0;
    if (discount.amountType === 'AMOUNT') {
      discountAmount = discount.amount;
    } else if (discount.amountType === 'PERCENT') {
      discountAmount = (discount.amount * totalPrice) / 100;
    }

    const finalPrice = this.applyDiscount(totalPrice, {
      amountType: discount.amountType,
      amount: discount.amount,
    });

    return { finalPrice, discountAmount };
  }

  calculateTotalShippingCost(parcels: ParcelWithShippingType[]) {
    return parcels.reduce((total, parcel) => {
      total += parcel.shippingType.price;
      return total;
    }, 0);
  }
  async checkFreeShipping(shipping: OrderShippingEntity, totalPrice: number) {
    if (totalPrice >= Number(this.MINIMUM_AMOUNT_FOR_FREE_SHIPPING)) {
      shipping.price = 0;
    }
    return shipping;
  }

  getParcelSizeCategory(carPartSize: CarPartSize) {
    switch (carPartSize) {
      case CarPartSize.GOVERNMENT_TIRES:
      case CarPartSize.TIRE:
        return CarPartSize.TIRE;
      case CarPartSize.BODY:
      case CarPartSize.EXTRA_LARGE:
        return carPartSize;
      case CarPartSize.SMALL:
      case CarPartSize.MEDIUM:
      case CarPartSize.LARGE:
      case CarPartSize.BATTERY:
      case CarPartSize.DISK:
        return 'general';
      default:
        throw new BadRequestException('ParcelSizeCategory not found');
    }
  }

  calculateParcels(cart: CartEntity) {
    const parcels: {
      items: CartItemEntity[];
      shipBySeller: boolean;
      supplierUserId?: number;
      sizeCategory?: string;
    }[] = [];

    cart.items.forEach((item) => {
      const supplierDeliveryType = item.config.supplier.supplierDeliveryType;
      const carPartSize = item.config.carPart.size;

      if (!supplierDeliveryType) {
        throw new BadRequestException('supplierDeliveryType not found');
      }

      const supplierUserId = item.config.supplierUserId;
      if (supplierDeliveryType !== SupplierDeliveryType.AUTOMOBY) {
        // Group by supplier and size if delivery type is not 'automoby'
        const sizeCategory = this.getParcelSizeCategory(carPartSize);
        const currentParcel = parcels.find(
          (parcel) =>
            parcel.supplierUserId === supplierUserId &&
            parcel.sizeCategory === sizeCategory,
        );
        if (!currentParcel) {
          parcels.push({
            items: [item],
            shipBySeller: true,
            supplierUserId: supplierUserId,
            sizeCategory,
          });
        } else {
          currentParcel.items.push(item);
        }
      } else {
        // Group by car part size if delivery type is 'automoby'
        const sizeCategory = this.getParcelSizeCategory(carPartSize);

        const currentParcel = parcels.find(
          (parcel) =>
            parcel.supplierUserId === undefined &&
            parcel.sizeCategory === sizeCategory,
        );
        if (!currentParcel) {
          parcels.push({
            items: [item],
            shipBySeller: false,
            sizeCategory,
          });
        } else {
          currentParcel.items.push(item);
        }
      }
    });

    return parcels;
  }

  async getUserAvailableShippingCostsEwano(
    userId: number,
    cityId: number,
    provinceId: number,
  ): Promise<ParcelAvailableShippingType[]> {
    const myCart = await this.cartService.getActiveCart(userId);
    const result = await this.getAvailableShippingCosts(
      myCart,
      cityId,
      provinceId,
    );
    return result;
  }

  async getUserAvailableShippingCosts(
    userId: number,
    cityId: number,
    provinceId: number,
    abTestVariants?: AbTestVariants,
  ): Promise<{
    shipping: ParcelAvailableShippingType[];
  }> {
    const myCart = await this.cartService.getActiveCart(
      userId,
      undefined,
      undefined,
      abTestVariants,
    );
    const availableShipping = await this.getAvailableShippingCosts(
      myCart,
      cityId,
      provinceId,
      abTestVariants,
    );
    const shipping = this.filterShippingOptionsRequiringCoordinates(
      availableShipping,
      abTestVariants,
    );
    return { shipping };
  }

  applyFreeShippingIfCategoryEligible(shippingTypes, parcel): void {
    const shouldFreeShipping = parcel.items.some((item) =>
      item.config?.carPart?.joinCategories?.some(
        (joinCategory) => joinCategory.category?.isFreeShipping === true,
      ),
    );

    if (shouldFreeShipping) {
      shippingTypes.forEach((shipping) => {
        shipping.price = 0;
        shipping.freeShippingReason = FreeShippingReason.CATEGORY_BASED;
      });
    }
  }

  async getAvailableShippingCosts(
    cart: CartEntity,
    cityId: number,
    provinceId: number,
    abTestVariants?: AbTestVariants,
  ): Promise<ParcelAvailableShippingType[]> {
    const fixedRet: ParcelAvailableShippingType[] = [];

    const parcels = this.calculateParcels(cart);

    // important: this sort is for proceedcheckout when front send parcels to compare
    // base on row attribute
    // Sort parcels first by supplierUserId, then by sizeCategory
    const sortedParcels = parcels.sort((a, b) => {
      // First sort by supplierUserId (nullish values last)
      if (a.supplierUserId && b.supplierUserId) {
        if (a.supplierUserId !== b.supplierUserId) {
          return a.supplierUserId - b.supplierUserId;
        }
      } else if (a.supplierUserId && !b.supplierUserId) {
        return -1;
      } else if (!a.supplierUserId && b.supplierUserId) {
        return 1;
      }

      // Then sort by sizeCategory
      if (a.sizeCategory && b.sizeCategory) {
        return a.sizeCategory.localeCompare(b.sizeCategory);
      } else if (a.sizeCategory && !b.sizeCategory) {
        return -1;
      } else if (!a.sizeCategory && b.sizeCategory) {
        return 1;
      }

      return 0;
    });

    const promises = sortedParcels.map(async (parcel, index) => {
      let tempShippingType: OrderShippingEntity[];

      if (parcel.shipBySeller) {
        const allSizes = [];
        for (const item of parcel.items) {
          allSizes.push(item?.config?.carPart?.size);
        }
        const size = Utils.calculateBasketSize(allSizes);
        // TODO: can query once and filter city in js
        tempShippingType = await this.orderShippingRepo.find({
          where: {
            cityId,
            provinceId,
            size,
            supplierUserId: parcel.supplierUserId,
          },
        });
        if (tempShippingType.length === 0) {
          tempShippingType = await this.orderShippingRepo.find({
            where: {
              provinceId,
              cityId: Utils.otherCities,
              size,
              supplierUserId: parcel.supplierUserId,
            },
          });
        }
        if (tempShippingType.length === 0) {
          tempShippingType = await this.orderShippingRepo.find({
            where: {
              provinceId: Utils.otherProvinces,
              cityId: Utils.otherCities,
              size,
              supplierUserId: parcel.supplierUserId,
            },
          });
        }

        const deadline = await this.calculateDeadline(
          this.highestPeriod(
            {
              items: parcel.items,
            },
            parcel.shipBySeller,
          ),
          undefined,
          parcel.shipBySeller,
          parcel.supplierUserId,
        );

        const shippingTypes = await this.addDeliveryTextToShippingTypes(
          tempShippingType,
          deadline,
          parcel.shipBySeller,
        );

        if (
          size === CarPartSize.TIRE ||
          size === CarPartSize.GOVERNMENT_TIRES
        ) {
          const totalQuantity = parcel.items.reduce(
            (acc, item) => acc + item.quantity,
            0,
          );
          shippingTypes.forEach((shipping) => {
            shipping.price *= totalQuantity;
            shipping.packingCost = (shipping.packingCost || 0) * totalQuantity;
          });
        }

        // this.applyFreeShippingIfCategoryEligible(shippingTypes, parcel);

        fixedRet.push({
          row: index + 1,
          parcel: parcel.items,
          shippingTypes: shippingTypes,
        });
      } else {
        const allSizes = [];
        for (const item of parcel.items) {
          allSizes.push(item?.config?.carPart?.size);
        }
        const size = Utils.calculateBasketSize(allSizes);

        tempShippingType = await this.orderShippingRepo.find({
          where: {
            cityId,
            provinceId,
            size,
            supplierUserId: IsNull(),
          },
        });
        if (tempShippingType.length === 0) {
          tempShippingType = await this.orderShippingRepo.find({
            where: {
              provinceId,
              cityId: Utils.otherCities,
              size,
              supplierUserId: IsNull(),
            },
          });
        }
        if (tempShippingType.length === 0) {
          tempShippingType = await this.orderShippingRepo.find({
            where: {
              provinceId: Utils.otherProvinces,
              cityId: Utils.otherCities,
              size,
              supplierUserId: IsNull(),
            },
          });
        }

        // For AUTOMOBY parcels, collect marketplace supplier IDs
        const automobySupplierIds = [
          ...new Set(
            parcel.items
              .filter((item) => item?.isMarketplace)
              .map((item) => item?.config?.supplierUserId)
              .filter(Boolean),
          ),
        ];
        const deadline = await this.calculateDeadline(
          this.highestPeriod(
            {
              items: parcel.items,
            },
            parcel.shipBySeller,
          ),
          undefined,
          parcel.shipBySeller,
          undefined,
          automobySupplierIds,
        );
        const shippingTypes = await this.addDeliveryTextToShippingTypes(
          tempShippingType,
          deadline,
          parcel.shipBySeller,
        );

        // Check if size is TIRE or GOVERNMENT_TIRES multiply price and packingCost to parcel items quantity
        if (
          size === CarPartSize.TIRE ||
          size === CarPartSize.GOVERNMENT_TIRES
        ) {
          const totalQuantity = parcel.items.reduce(
            (acc, item) => acc + item.quantity,
            0,
          );
          shippingTypes.forEach((shipping) => {
            shipping.price *= totalQuantity;
            shipping.packingCost = (shipping.packingCost || 0) * totalQuantity;
          });
        }

        // this.applyFreeShippingIfCategoryEligible(shippingTypes, parcel);

        fixedRet.push({
          row: index + 1,
          parcel: parcel.items,
          shippingTypes: shippingTypes,
        });
      }
    });

    await Promise.all(promises); // منتظر می‌مانیم تا همه وعده‌ها کامل شوند

    fixedRet.forEach((item) => {
      item.shippingTypes.forEach((shippingType) => {
        const shippingCfg = this.abTestService.getShippingPriceOverride(
          shippingType.id,
          item.parcel,
          abTestVariants,
        );
        shippingType.price =
          shippingCfg !== null
            ? shippingCfg.shippingPrice
            : Utils.roundPrice(shippingType.price, 3);
      });
    });

    return fixedRet; // آرایه پر شده را برمی‌گردانیم
  }

  isSnappBoxShippingAllowed(abTestVariants?: AbTestVariants): boolean {
    if (!this.SNAPPBOX_ENABLED) {
      return false;
    }

    const config = abTestVariants?.map_strategy?.variantConfig;
    if (!config || !isMapStrategyConfig(config)) return true;
    return config.map_enabled !== false;
  }

  private filterShippingOptionsRequiringCoordinates(
    availableShippings: ParcelAvailableShippingType[],
    abTestVariants?: AbTestVariants,
  ): ParcelAvailableShippingType[] {
    if (this.isSnappBoxShippingAllowed(abTestVariants)) {
      return availableShippings;
    }

    const couriersRequiringCoordinates: ParcelShippingCourier[] = [
      ParcelShippingCourier.SNAPP,
    ];

    return availableShippings.map((item) => ({
      ...item,
      shippingTypes: item.shippingTypes.filter(
        (st) =>
          !st.courier || !couriersRequiringCoordinates.includes(st.courier),
      ),
    }));
  }

  async addDeliveryTextToShippingTypes(
    shippingTypes: OrderShippingEntity[],
    deadline: Date,
    isShipBySeller: boolean,
  ) {
    const fixedRet = await Promise.all(
      shippingTypes.map(async (item) => {
        const shippingDuration = item.shippingDuration;

        const { deliveryText, deliveryDeadline } =
          await this.getDeliveryDayTextAtCart(deadline, shippingDuration);

        const deadlineWithoutHours = new Date(deadline);
        deadlineWithoutHours.setHours(0, 0, 0, 0);

        return {
          ...item,
          processDate: deadlineWithoutHours,
          deliveryText: deliveryText,
          prepDeadline: isShipBySeller ? deadline : null,
          collectDeadline: isShipBySeller ? null : deadline,
          isShipBySeller: isShipBySeller,
          isExpressShipping: this.isEpressShipping(shippingDuration, deadline),
          deliveryDeadline,
          freeShippingReason: null,
        };
      }),
    );

    return fixedRet;
  }

  isEpressShipping(
    shippingDuration: ShippingDurationEnum,
    deadline: Date,
  ): boolean {
    const shippingDurationLength =
      OrderUtils.getShippingDurationLentgh(shippingDuration);
    const now = new Date();
    if (shippingDurationLength < 24 && Utils.isSameDay(deadline, now)) {
      return true;
    }
    return false;
  }

  getDeliveryDayText(deliveryDeadline: Date, isExpress: boolean): string {
    if (!deliveryDeadline) return 'نا مشخص';
    if (isExpress) {
      return (
        OrderUtils.formatDeliveryDateFa(deliveryDeadline, new Date()) +
        `، ساعت ${deliveryDeadline.getHours() + 1}`
      );
    } else {
      return OrderUtils.formatDeliveryDateFa(deliveryDeadline, new Date());
    }
  }

  async getDeliveryDayTextAtCart(
    deadline: Date,
    shippingDuration: ShippingDurationEnum,
  ): Promise<{ deliveryText: string; deliveryDeadline: Date }> {
    const now = new Date();
    const shippingDurationLength =
      OrderUtils.getShippingDurationLentgh(shippingDuration);

    // If Express Shipping
    if (this.isEpressShipping(shippingDuration, deadline)) {
      const deliveryHoure = deadline.getHours() + shippingDurationLength;
      const deliveryDeadline = new Date(
        deadline.getTime() + shippingDurationLength * 60 * 60 * 1000,
      );
      return {
        deliveryText: `امروز ساعت ${deliveryHoure} تا ${deliveryHoure + 1}`,
        deliveryDeadline,
      };
    }

    const shippingDurationDays = Math.floor(shippingDurationLength / 24);
    // Calculate initial delivery date
    const deliveryDate = addDays(deadline, shippingDurationDays);
    // Find first working day
    const finalDeliveryDate =
      await this.processCapacityService.getNextWorkingDayFrom(deliveryDate, 1);
    const deliveryDays = differenceInCalendarDays(finalDeliveryDate, deadline);
    const deliveryDeadline = new Date(
      deadline.getTime() + deliveryDays * 24 * 60 * 60 * 1000,
    );

    // If shipping duration is like 2-4 working days
    if (OrderUtils.isDeliveryRange(shippingDuration)) {
      const startDate = addDays(
        deliveryDeadline,
        -1 * OrderUtils.getDeliveryRange(shippingDuration), // -1 is for minus
      );
      const startDays = OrderUtils.formatDeliveryDateFa(startDate, now, false);
      const endDate = OrderUtils.formatDeliveryDateFa(
        deliveryDeadline,
        now,
        false,
      );
      return {
        deliveryText: `${startDays} تا ${endDate}`,
        deliveryDeadline,
      };
    }

    // else
    // Normal case: use existing code
    return {
      deliveryText: OrderUtils.formatDeliveryDateFa(finalDeliveryDate, now),
      deliveryDeadline,
    };
  }

  async getCartItemsbyOrderId(ids: readonly IOrderItem['id'][]) {
    return this.orderItemRepo.find({
      where: { orderId: In([-1, ...ids]) },
      relations: ['user'],
    });
  }

  async getCartItemsByOrderIdsAndUserIds(
    orderIds: number[],
    supplierUserIds: number[],
  ) {
    return this.orderItemRepo.find({
      where: {
        orderId: In(orderIds),
        config: {
          supplierUserId: In(supplierUserIds),
        },
      },
      relations: ['config'],
    });
  }

  /* ------------------------------ Start CronJob ----------------------------- */

  async findOrdersByStateAndUpdatedBetween(
    state: CartStateEnum,
    startTime: Date,
    endTime: Date,
  ) {
    return this.cartRepo.find({
      where: {
        state: state,
        updatedDate: Between(startTime, endTime),
      },
    });
  }

  async hasActiveCart(userId: number): Promise<boolean> {
    const count = await this.cartRepo.count({
      where: {
        userId: userId,
        state: CartStateEnum.ACTIVE,
      },
    });
    return count > 0;
  }

  async findPaidOrdersOlderThan(
    startTime: Date,
    endTime: Date,
  ): Promise<OrderEntity[]> {
    return this.repo.find({
      where: {
        updatedDate: Between(startTime, endTime),
      },
    });
  }

  /* ------------------------------- End CronJob ------------------------------ */

  //TODO Parcel: Needs review
  async moveParcelToWaitingForPacking(
    physicalItemId: number,
    queryRunner: QueryRunner,
    userId?: number,
  ) {
    const parcel = await queryRunner.manager.findOne(ParcelEntity, {
      where: {
        physicalOrderItems: { physicalItem: { id: physicalItemId } },
      },
      relations: {
        physicalOrderItems: { physicalItem: true },
      },
    });

    if (!parcel) {
      throw new BadRequestException('Parcel not found');
    }

    if (parcel.state !== ParcelStateEnum.CANCELLED_ADMIN) {
      const nextState = ParcelStateEnum.WAITING_FOR_PACKING;
      await this.parcelChangeStateService.changeState(
        parcel.id,
        nextState,
        queryRunner,
        userId ? { userId } : undefined,
      );
    }
  }

  //TODO Parcel: Needs review
  async adminWatingForPacking(
    parcelInput: parcelInput,
    userId: number,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { parcelId } = parcelInput;

      const order = await this.repo.findOne({
        where: { parcels: { id: parcelId } },
        relations: { user: true },
      });

      await this.parcelChangeStateService.changeState(
        parcelId,
        ParcelStateEnum.WAITING_FOR_PACKING,
        queryRunner,
        { userId },
      );

      try {
        const link =
          order.domainNameEn === DomainNameEn.EN_PARTIFA
            ? 'atmb.ir/pacstatep'
            : 'atmb.ir/pacstatea';
        const brand = this.getDomainNameFaFromOrder(order);
        this.smsService.sendSMS(
          SMSTypes.PARCEL_WAITING_FOR_PACKING,
          order?.user?.phoneNumber,
          {
            brand,
            link,
          },
          this.messagingService.getSMSSenderNumber(brand),
        );
      } catch (error) {
        this.logger.error(
          'parcel_packing_sms_failed',
          toError(error),
          'OrderService',
          {
            // PII rule 6: phone masked to last 4 digits.
            phoneNumber: order?.user?.phoneNumber
              ? `****${String(order.user.phoneNumber).slice(-4)}`
              : undefined,
            orderId: order?.id,
          },
        );
      }
      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Error will be logged centrally by AllExceptionsFilter
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  //TODO Parcel: Needs review
  async adminWatingForShipment(
    parcelInput: parcelInput,
    userId: number,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const { parcelId } = parcelInput;

      const order = await this.repo.findOne({
        where: { parcels: { id: parcelId } },
        relations: { user: true },
      });

      await this.parcelChangeStateService.changeState(
        parcelId,
        ParcelStateEnum.WAITING_FOR_SHIPMENT,
        queryRunner,
        { userId },
      );

      // If this Automoby parcel was assigned to SnappBox at checkout,
      // create the SnappBox order inside the same transaction.
      // Hard-fail: any SnappBox API error rolls back the state change too.
      // Cheap SELECT id,courier first so we only pay the deep relation
      // load when the parcel is actually SnappBox-bound.
      const courier = await this.parcelService.getParcelCourierById(parcelId);
      if (courier === ParcelShippingCourier.SNAPP) {
        const parcel = await queryRunner.manager.findOne(ParcelEntity, {
          where: { id: parcelId },
          relations: {
            order: { addressClone: true, user: true },
            physicalOrderItems: {
              orderItem: true,
              physicalItem: { config: { carPart: true } },
            },
          },
        });
        if (!parcel?.order) {
          throw new Error(
            `Parcel ${parcelId} has no related order; cannot dispatch SnappBox`,
          );
        }
        await this.snappBoxService.automobyCreateSnappBoxOrder(
          parcel,
          parcel.order,
          queryRunner.manager,
        );
      }

      try {
        const link =
          order.domainNameEn === DomainNameEn.EN_PARTIFA
            ? 'atmb.ir/delstatep'
            : 'atmb.ir/delstatea';
        const brand = this.getDomainNameFaFromOrder(order);
        this.smsService.sendSMS(
          SMSTypes.PARCEL_WAITING_FOR_SHIPMENT,
          order?.user?.phoneNumber,
          {
            brand,
            link,
          },
          this.messagingService.getSMSSenderNumber(brand),
        );
      } catch (error) {
        this.logger.error(
          'parcel_shipment_sms_failed',
          toError(error),
          'OrderService',
          {
            // PII rule 6: phone masked to last 4 digits.
            phoneNumber: order?.user?.phoneNumber
              ? `****${String(order.user.phoneNumber).slice(-4)}`
              : undefined,
            orderId: order?.id,
          },
        );
      }

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Error will be logged centrally by AllExceptionsFilter
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async adminShippingDelivered(
    parcelInput: parcelInput,
    userId: number,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { parcelId } = parcelInput;

      await this.parcelChangeStateService.changeState(
        parcelId,
        ParcelStateEnum.DELIVERED,
        queryRunner,
        { userId },
      );

      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { parcels: { id: parcelId } },
        relations: {
          parcels: true,
          addressClone: true,
          user: true,
          payment: { transactions: true },
          items: {
            config: {
              carPart: true,
            },
          },
        },
        order: {
          payment: {
            transactions: {
              id: 'ASC', //important transactions[0] !!
            },
          },
        },
      });

      try {
        if (order.paymentType === PaymentType.DIGI_PAY) {
          await this.digipayService.deliverProducts({
            deliveryDate: Date.now(),
            trackingCode: order.payment.transactions[0].trackingNumber,
            invoiceNumber: order.id.toString(),
            products: order.items.map((item) => item.config.carPart.name),
          });
        }
      } catch (error) {
        // Swallowed (delivery notify must not fail the state transition) —
        // logger.error is the single Sentry capture.
        this.logger.error(
          'order_delivered_thirdparty_notify_failed',
          toError(error),
          'OrderService',
          { orderId: order.id, gateway: 'digipay' },
        );
      }

      try {
        if (order.domainNameEn !== DomainNameEn.EN_EWANO) {
          const brand = this.getDomainNameFaFromOrder(order);
          const link =
            brand === 'اتوموبی'
              ? 'atmb.ir/autosurvey'
              : 'atmb.ir/partifasurvey';

          await this.smsService.sendSMS(
            SMSTypes.PARCEL_DELIVERED,
            order?.user?.phoneNumber,
            {
              brand,
              link,
            },
            this.messagingService.getSMSSenderNumber(brand),
          );
        }
      } catch (error) {
        this.logger.error(
          'order_survey_sms_failed',
          toError(error),
          'OrderService',
          {
            // PII rule 6: phone masked to last 4 digits.
            phoneNumber: order.user.phoneNumber
              ? `****${String(order.user.phoneNumber).slice(-4)}`
              : undefined,
            orderId: order.id,
          },
        );
      }

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Error will be logged centrally by AllExceptionsFilter
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async sellerShippingDelivered(
    parcelInput: parcelInput,
    userId: number,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { parcelId } = parcelInput;

      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { parcels: { id: parcelId } },
        relations: {
          parcels: true,
          addressClone: true,
          user: true,
          payment: { transactions: true },
          items: {
            config: {
              carPart: true,
            },
          },
        },
        order: {
          payment: {
            transactions: {
              id: 'ASC', //important transactions[0] !!
            },
          },
        },
      });

      if (
        order.parcels[0].parcelDeliveryMethod !== ParcelDeliveryMethod.SELLER
      ) {
        throw new BadRequestException('سفارش از نوع ارسال فروشنده نیست');
      }

      const acl = await this.roleService.getAclByUserId(userId);

      if (acl.roleId !== 1) {
        //ادمین بتواند سفارش اس بی اس رو هم ارسال شد بزند
        const itemWithTargetTempParcelId = order.items.find(
          (item) => item.tempParcelId === parcelId,
        );

        const supplierUserId =
          itemWithTargetTempParcelId?.config.supplierUserId;

        if (supplierUserId !== userId) {
          throw new BadRequestException('اجازه ارسال سفارش دیگران را ندارید');
        }
      }

      await this.parcelChangeStateService.changeState(
        parcelId,
        ParcelStateEnum.SELLER_DELIVERED,
        queryRunner,
        { userId },
      );

      try {
        if (order.paymentType === PaymentType.DIGI_PAY) {
          await this.digipayService.deliverProducts({
            deliveryDate: Date.now(),
            trackingCode: order.payment.transactions[0].trackingNumber,
            invoiceNumber: order.id.toString(),
            products: order.items.map((item) => item.config.carPart.name),
          });
        }
      } catch (error) {
        // Swallowed (delivery notify must not fail the state transition) —
        // logger.error is the single Sentry capture.
        this.logger.error(
          'order_delivered_thirdparty_notify_failed',
          toError(error),
          'OrderService',
          { orderId: order.id, gateway: 'digipay' },
        );
      }

      try {
        if (order.domainNameEn !== DomainNameEn.EN_EWANO) {
          const brand = this.getDomainNameFaFromOrder(order);
          const link =
            brand === 'اتوموبی'
              ? 'atmb.ir/autosurvey'
              : 'atmb.ir/partifasurvey';

          await this.smsService.sendSMS(
            SMSTypes.PARCEL_DELIVERED,
            order?.user?.phoneNumber,
            {
              brand,
              link,
            },
            this.messagingService.getSMSSenderNumber(brand),
          );
        }
      } catch (error) {
        this.logger.error(
          'order_survey_sms_failed',
          toError(error),
          'OrderService',
          {
            // PII rule 6: phone masked to last 4 digits.
            phoneNumber: order.user.phoneNumber
              ? `****${String(order.user.phoneNumber).slice(-4)}`
              : undefined,
            orderId: order.id,
          },
        );
      }

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Error will be logged centrally by AllExceptionsFilter
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async sellerConfirmProccessing(
    parcelInput: parcelInput,
    userId: number,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { parcelId } = parcelInput;

      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { parcels: { id: parcelId } },
        relations: {
          parcels: true,
          items: {
            config: true,
          },
        },
      });

      const itemWithTargetTempParcelId = order.items.find(
        (item) => item.tempParcelId === parcelId,
      );

      const supplierUserId = itemWithTargetTempParcelId?.config.supplierUserId;

      if (supplierUserId !== userId) {
        throw new BadRequestException('اجازه تایید سفارش دیگران را ندارید');
      }

      await this.parcelChangeStateService.changeState(
        parcelId,
        ParcelStateEnum.PROCESSING,
        queryRunner,
        { userId },
      );

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Error will be logged centrally by AllExceptionsFilter
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  //delete this func?
  async adminParcelGetShippingStatus(parcelId: number) {
    const parcel = await this.parcelRepo.findOne({
      where: { id: parcelId },
      relations: { order: true },
    });

    const events = await this.orderEventRepo.find({
      where: { parcelId, type: OrderEventTypeEnum.COMMENT },
      order: { createdDate: 'DESC' },
    });

    if (!parcel) throw new BadRequestException('parcel not found');

    // const hasBeenShipped = parcel.state === ParcelStateEnum.SHIPPED;

    const res = {
      orderEvents: events,
      parcel,
      // hasBeenShipped,
    };

    return res;
  }

  async adminCancelOrder(
    cancelOrderInput: CancelOrderInput,
    user: JwtDto,
    callThirdParty = true,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { orderId, reason, description } = cancelOrderInput;
      const parcels = await this.getParcelsByOrderIds([orderId]);
      await Promise.all(
        parcels.map(
          async (parcel) =>
            await this.parcelService.adminParcelCancel(
              {
                parcelId: parcel.id,
                reason,
                description,
              },
              user,
              false, // callThirdParty
              { queryRunner },
            ),
        ),
      );
      // Cascade-cancel installation reserves of this order (OI-2). Same
      // transaction as the parcel cancels above so it's atomic. Order-cancel is
      // always admin-triggered here, so the reason is ORDER_CANCELLED_BY_ADMIN.
      await this.installationLifecycleService.cancelActiveReservesForOrder(
        orderId,
        InstallationReserveCancelReasonEnum.ORDER_CANCELLED_BY_ADMIN,
        description ?? null,
        queryRunner,
      );

      await this.cancelOrderThirdPartyAndSendSms(
        orderId,
        user.id,
        queryRunner,
        callThirdParty,
      );
      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Error will be logged centrally by AllExceptionsFilter
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async adminCancelOrderCallSnapp(
    transactionIdInput: transactionIdInput,
  ): Promise<boolean> {
    const { transactionId } = transactionIdInput;
    const payment = await this.paymentService.getTransacionByTransactionId(
      transactionId,
    );
    try {
      await this.snapp.cancel(payment.extraInfo);
    } catch (error) {
      // Translated to a 4xx below — this is the single Sentry capture for
      // the underlying gateway failure (ADR-037 rule 8).
      this.logger.error('snapp_cancel_failed', toError(error), 'OrderService', {
        gateway: 'snapp_pay',
        operation: 'cancel',
        transactionId,
      });
      throw new BadRequestException(
        (error as Error)?.message ?? 'خطا در لغو تراکنش اسنپ‌پی',
      );
    }
    return true;
  }

  async adminCancelOrderCallTorob(
    transactionIdInput: transactionIdInput,
  ): Promise<boolean> {
    const { transactionId } = transactionIdInput;
    const payment = await this.paymentService.getTransacionByTransactionId(
      transactionId,
    );
    try {
      await this.torob.cancel(payment.extraInfo);
    } catch (error) {
      // Translated to a 4xx below — this is the single Sentry capture.
      this.logger.error('torob_cancel_failed', toError(error), 'OrderService', {
        gateway: 'torob_pay',
        operation: 'cancel',
        transactionId,
      });
      throw new BadRequestException(
        (error as Error)?.message ?? 'خطا در لغو تراکنش ترب‌پی',
      );
    }
    return true;
  }

  async adminCancelOrderCallDigiPay(
    input: AdminCancelOrderCallDigiPayInput,
  ): Promise<boolean> {
    const { orderId, amount } = input;
    const order = await this.repo.findOne({
      where: { id: orderId },
      select: { id: true, paymentId: true },
    });
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    const payment = await this.paymentService.getPaymentById(order.paymentId);
    if (!payment?.transactions?.length) {
      throw new BadRequestException('Payment or transactions not found');
    }
    const paymentTransaction = payment.transactions
      .filter((t) => t.paymentType === PaymentType.DIGI_PAY)
      .sort((a, b) => a.id - b.id)[0];
    if (!paymentTransaction) {
      throw new BadRequestException(
        'DigiPay transaction not found for this order',
      );
    }
    if (!paymentTransaction.trackingNumber) {
      throw new BadRequestException('Tracking number not found');
    }
    const uniqeId = uuidv4();
    try {
      await this.digipayService.processRefund({
        providerId: uniqeId,
        amount,
        saleTrackingCode: paymentTransaction.trackingNumber,
      });
    } catch (error) {
      // Translated to a 4xx below — this is the single Sentry capture for
      // the underlying refund failure (money path).
      this.logger.error(
        'digipay_refund_failed',
        toError(error),
        'OrderService',
        {
          gateway: 'digipay',
          operation: 'refund',
          orderId,
          amount,
          trackingNumber: paymentTransaction.trackingNumber,
        },
      );
      const e = error as Error & { responseData?: unknown };
      const detail = e?.responseData
        ? JSON.stringify(e.responseData)
        : e?.message;
      throw new BadRequestException(detail ?? 'خطا در استرداد دیجی‌پی');
    }
    return true;
  }

  async cancelOrderThirdPartyAndSendSms(
    orderId: number,
    userId: number,
    queryRunner: QueryRunner,
    callThirdParty?: boolean,
  ): Promise<boolean> {
    const order = await queryRunner.manager.findOne(OrderEntity, {
      where: { id: orderId },
      relations: {
        user: true,
        items: {
          config: {
            carPart: {
              joinCategories: {
                category: true,
              },
            },
          },
          physicalOrderItems: { physicalItem: true },
        },
        payment: {
          transactions: true,
        },
      },
    });
    if (!order) throw new BadRequestException('Order not found');
    const paymentTransaction = await queryRunner.manager.findOne(
      PaymentTransactionEntity,
      {
        where: {
          paymentId: order.paymentId,
          state: PaymentTransactionState.SUCCESS,
        },
        order: { id: 'ASC' },
      },
    );

    if (!paymentTransaction)
      throw new BadRequestException('paymentTransaction not found');

    // SAMAN/Takhfifan: report the cancellation to the Takhfifan affiliate API.
    // This is a side-effect (zeroing affiliate revenue), NOT a money refund —
    // the SAMAN gateway itself has no full/partial reverse, so the actual refund
    // is handled as a ManualRefundEntity by RefundService.refundFull below.
    if (paymentTransaction.paymentType === PaymentType.SAMAN) {
      const takhfifanOrder = await this.takhfifanService.getTakhfifanByOrderId(
        order.id,
      );
      if (
        takhfifanOrder &&
        !this.takhfifanPaymentService.checkIfMoreThanTenDaysPassed(
          takhfifanOrder.createDate,
        )
      ) {
        const takhfifanPaymentCancelData =
          await this.takhfifanPaymentService.preparationDataForCancelTakhfifanApi(
            order,
            takhfifanOrder.token,
            paymentTransaction,
          );
        await this.takhfifanPaymentService.updateOrCancel(
          takhfifanPaymentCancelData,
        );
      }
    }

    // Full reverse of the whole remaining balance, per gateway. RefundService is
    // now the single owner of refund dispatch: auto reverse + negative
    // transaction for reversible gateways, a ManualRefundEntity for SAMAN, no-op
    // for KEEPA/ITOL. It does NOT touch order.totalPrice (terminal cancel).
    // `order.totalPrice` is already the net remaining balance (prior partial
    // cancellations reduced it). callThirdParty defaults to false to preserve
    // the legacy `if (callThirdParty)` gating for TARA/EWANO/ZARINPLUS/AZKI.
    await this.refundService.refundFull({
      order,
      amount: order.totalPrice,
      userId: order.userId,
      idempotencyKey: `ORDER-CANCEL-${order.id}`,
      manager: queryRunner.manager,
      callThirdParty: callThirdParty ?? false,
    });

    this.logger.log('cancel whole order called', 'OrderService');

    try {
      const brand = this.getDomainNameFaFromOrder(order);
      const sender = this.messagingService.getSMSSenderNumber(brand);

      if (order.paymentType === PaymentType.SAMAN) {
        await this.smsService.sendSMS(
          SMSTypes.ORDER_CANCEL_SAMAN,
          order?.user?.phoneNumber,
          {
            brand,
            profileLink: this.messagingService.getProfileLink(brand),
          },
          sender,
        );
      } else {
        const orderCancelSmsTypes: Partial<Record<PaymentType, SMSTypes>> = {
          [PaymentType.SNAPP_PAY]: SMSTypes.ORDER_CANCEL_SNAPP,
          [PaymentType.TARA]: SMSTypes.ORDER_CANCEL_TARA,
          [PaymentType.DIGI_PAY]: SMSTypes.ORDER_CANCEL_DIGIPAY,
          [PaymentType.TOROB_PAY]: SMSTypes.ORDER_CANCEL_TOROB,
        };
        const smsType = orderCancelSmsTypes[order.paymentType];

        if (smsType) {
          await this.smsService.sendSMS(
            smsType,
            order?.user?.phoneNumber,
            {
              brand,
              refundDelayHours: Utils.getPhysicalItemCancelRefundDelayHours(
                order.paymentType,
              ),
            },
            sender,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'order_cancel_sms_failed',
        toError(error),
        'OrderService',
        {
          // PII rule 6: phone masked to last 4 digits.
          phoneNumber: order?.user?.phoneNumber
            ? `****${String(order.user.phoneNumber).slice(-4)}`
            : undefined,
          orderId,
        },
      );
    }

    return true;
  }

  /**
   * Assemble the SnappPay/TorobPay payment re-issue payload (`update`) for a
   * reduced cart. SNAPP/TOROB have no amount-based partial-refund endpoint: a
   * partial refund is done by re-issuing the WHOLE payment with the remaining
   * cart, and the gateway recomputes the customer's installment plan from it.
   *
   * Pure / no I/O — every money input is supplied by the caller so this stays
   * shared between the two triggers that produce a reduced cart:
   *  - editOrderThirdParty (goods cancel): remaining goods + active install lines.
   *  - refundReserveShare (installation cancel): all goods + remaining install lines.
   *
   * `amountToman` is the authoritative new charged amount (the gateway bills
   * this, not Σ cartItems). cartItems/totalAmount are the descriptive,
   * pre-discount breakdown; discount/shipping live in their own fields.
   *
   * Returns undefined for any non-SNAPP/TOROB gateway (those refund by amount).
   */
  assembleBnplReissueCart(params: {
    cartId: number;
    paymentType: PaymentType;
    paymentToken: string;
    amountToman: number;
    discountToman: number;
    shippingToman: number;
    goodsLines: {
      id: number;
      name: string;
      count: number;
      amountToman: number;
    }[];
    installLines: {
      id: number;
      name: string;
      count: number;
      unitAmount: number;
    }[];
  }): SnappPayUpdateDto | undefined {
    const { paymentType } = params;
    if (
      paymentType !== PaymentType.SNAPP_PAY &&
      paymentType !== PaymentType.TOROB_PAY
    ) {
      return undefined;
    }

    const CATEGORY = 'لوازم یدکی ماشین';
    const cartItems = params.goodsLines
      .map((l) => ({
        id: l.id,
        amount: l.amountToman * 10,
        category: CATEGORY,
        count: l.count,
        name: l.name,
      }))
      .concat(
        params.installLines.map((l) => ({
          id: l.id,
          amount: l.unitAmount * 10,
          category: CATEGORY,
          count: l.count,
          name: l.name,
        })),
      );

    let totalAmount = cartItems.reduce((sum, it) => sum + it.amount, 0);
    let shippingAmount = params.shippingToman * 10;

    // SnappPay update rejects with errorCode 1005 ("اطلاعات وارد شده نامعتبر است")
    // when every item is cancelled and only shipping cost remains (cartItems
    // empty, totalAmount=0, shippingAmount>0). Inject a placeholder line item and
    // deduct it from shippingAmount so the total billed amount is unchanged.
    // SNAPP-only (TOROB has never needed it — preserve its prior behavior).
    const SNAPP_PAY_PLACEHOLDER_AMOUNT = 10000;
    if (
      paymentType === PaymentType.SNAPP_PAY &&
      cartItems.length === 0 &&
      shippingAmount >= SNAPP_PAY_PLACEHOLDER_AMOUNT
    ) {
      cartItems.push({
        id: 0,
        amount: SNAPP_PAY_PLACEHOLDER_AMOUNT,
        category: CATEGORY,
        count: 1,
        name: 'هزینه ارسال به دلیل اشتباه کاربر',
      });
      totalAmount += SNAPP_PAY_PLACEHOLDER_AMOUNT;
      shippingAmount -= SNAPP_PAY_PLACEHOLDER_AMOUNT;
    }

    return {
      amount: params.amountToman * 10,
      paymentToken: params.paymentToken,
      discountAmount: params.discountToman * 10,
      cartList: [
        {
          cartId: params.cartId,
          cartItems,
          totalAmount,
          shippingAmount,
          taxAmount: 0,
          isShipmentIncluded: true,
          isTaxIncluded: true,
        },
      ],
    };
  }

  /**
   * Build the SnappPay/TorobPay re-issue cart for an order's CURRENT remaining
   * state, with the charged amount reduced by `reduceByToman` (the share being
   * refunded). Used by the installation-cancel refund path (refundReserveShare):
   * when a single reserve is cancelled but goods or other reserves remain, the
   * SNAPP/TOROB partial refund must re-issue the reduced cart rather than fall
   * back to a manual row.
   *
   * Cart contents = ALL active goods (a reserve cancel never touches goods) +
   * the remaining active installation lines. getInstallationCartLinesForOrder
   * already excludes the just-cancelled reserve (its state was flipped to a
   * terminal CANCELLED before this runs), so it returns exactly what remains.
   *
   * Returns undefined for non-SNAPP/TOROB gateways (assembler short-circuits) and
   * when the order has no captured payment.
   */
  async buildReissueCartForOrder(
    orderId: number,
    reduceByToman: number,
    queryRunner: QueryRunner,
  ): Promise<SnappPayUpdateDto | undefined> {
    const order = await queryRunner.manager.findOne(OrderEntity, {
      where: { id: orderId },
      relations: {
        items: { config: { carPart: true } },
        parcels: true,
        payment: { transactions: true },
      },
      order: { payment: { transactions: { id: 'ASC' } } },
    });
    if (!order?.payment) return undefined;

    const mainTx = order.payment.transactions?.find(
      (t) => t.state === PaymentTransactionState.SUCCESS,
    );
    if (!mainTx) return undefined;

    // Shipping that is still billed = parcels whose shipping cost was not refunded.
    // A reserve cancel does not change parcels, so this is the order's current
    // shipping/packing total.
    const shippingToman = (order.parcels ?? [])
      .filter((p) => !p.isShippingCostRefunded)
      .reduce(
        (sum, p) => sum + (p.shippingCost || 0) + (p.packingCost || 0),
        0,
      );

    const installLines =
      await this.installationReserveQueryService.getInstallationCartLinesForOrder(
        orderId,
        queryRunner.manager,
      );

    return this.assembleBnplReissueCart({
      cartId: order.id,
      paymentType: mainTx.paymentType,
      paymentToken: mainTx.extraInfo,
      amountToman: order.totalPrice - reduceByToman,
      discountToman: order.discountAmount,
      shippingToman,
      goodsLines: (order.items ?? [])
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          id: item.configId,
          name: item.config.carPart.name,
          count: item.quantity,
          amountToman: item.checkoutPrice,
        })),
      installLines,
    });
  }

  async editOrderThirdParty(
    orderId: number,
    physicalOrderItemIds: number[],
    queryRunner: QueryRunner,
    callThirdParty: boolean = true,
    shouldRefundShipping?: boolean,
    parcelId?: number,
  ): Promise<boolean> {
    const uniqeId = uuidv4();
    const order = await queryRunner.manager.findOne(OrderEntity, {
      where: { id: orderId },
      relations: {
        discount: true,
        items: {
          physicalOrderItems: true,
          config: {
            carPart: true,
          },
        },
        payment: {
          transactions: true,
        },
        parcels: true,
      },
      order: {
        payment: {
          transactions: {
            id: 'ASC',
          },
        },
      },
    });
    if (!order) throw new BadRequestException('Order not found');

    let newTotalPrice = 0;

    order.items.map((orderItem) => {
      // calc how many quantity canceled is in each orderItem
      const physicalOrderItems = orderItem.physicalOrderItems.filter(
        (physicalOrderItem) =>
          physicalOrderItemIds.includes(physicalOrderItem.id),
      );
      const canceledQuantity = physicalOrderItems?.length || 0;
      orderItem.quantity -= canceledQuantity;
      newTotalPrice += orderItem.quantity * orderItem.checkoutPrice;
    });

    order.items.forEach((orderItem) => {
      orderItem.physicalOrderItems = undefined;
    });

    if (order.discount?.minimumPurchasePrice > newTotalPrice) {
      throw new BadRequestException(
        'Total price is less than the minimum purchase price for the discount',
      );
    }

    const oldTotalPrice = order.totalPrice;

    // Calculate shipping and packing costs
    // Sum all parcels that haven't had their shipping cost refunded
    // If shouldRefundShipping is true for the current parcel, exclude it and mark it as refunded
    let shippingCost = 0;
    let packingCost = 0;
    let targetParcel: ParcelEntity | undefined;

    if (parcelId) {
      targetParcel = order.parcels.find((p) => p.id === parcelId);
      if (!targetParcel) {
        throw new BadRequestException('Parcel not found in order');
      }
    }

    // Calculate shipping cost from all parcels that haven't been refunded
    // If shouldRefundShipping is true, exclude the current parcel from calculation
    order.parcels.forEach((parcel) => {
      // Skip parcels that already have shipping cost refunded
      if (parcel.isShippingCostRefunded) {
        return;
      }

      // If this is the target parcel and shouldRefundShipping is true, skip it
      if (parcelId && parcel.id === parcelId && shouldRefundShipping) {
        return;
      }

      // Add this parcel's shipping and packing costs
      shippingCost += parcel.shippingCost || 0;
      packingCost += parcel.packingCost || 0;
    });

    // Mark the parcel as shipping cost refunded if shouldRefundShipping is true
    if (targetParcel && shouldRefundShipping) {
      await queryRunner.manager.update(
        ParcelEntity,
        { id: targetParcel.id },
        { isShippingCostRefunded: true },
      );
    }

    // we make parcels undefined to dont accidentally update them in order update query below
    order.parcels = undefined;

    const shippingAndPackingCost = shippingCost + packingCost;

    // Preserve the installation portion of order.totalPrice. Editing GOODS must
    // not touch the order's active (non-cancelled) installation reserves; if we
    // recomputed the total from goods alone, the installation amount would drop
    // out of totalPrice and `differenceTotalPrice` would over-refund it. Feed
    // the same split the function uses: parts join the discountable base, the
    // service fee + gateway fee are added after (undiscounted) — exactly how
    // proceedCheckout built the total.
    const installTotals =
      await this.installationReserveQueryService.sumActiveInstallationTotalsForOrder(
        orderId,
        queryRunner.manager,
      );

    const { finalTotalPrice, discountAmount } =
      await this.calculateDiscountAndShippingCostAndAdjustTotal(
        order,
        newTotalPrice,
        order.discount,
        shippingCost,
        packingCost,
        0,
        queryRunner,
        installTotals.partPriceTotal,
        installTotals.serviceFeeTotal + installTotals.feeTotal,
      );

    // its also a nagetive number
    const differenceTotalPrice = finalTotalPrice - oldTotalPrice;
    order.totalPrice = finalTotalPrice;
    order.discountAmount = discountAmount;

    await queryRunner.manager.update(
      OrderEntity,
      { id: orderId },
      { ...order, updatedDate: undefined, items: undefined },
    );
    await Promise.all(
      order.items.map((item) =>
        queryRunner.manager.update(
          OrderItemEntity,
          { id: item.id },
          { ...item, updatedDate: undefined },
        ),
      ),
    );

    // in select query, order.payment.transactions is ordered by updateDate ASC
    // so the first success transaction is the main transaction
    const mainPaymentTransaction = order.payment.transactions.find(
      (t) => t.state === PaymentTransactionState.SUCCESS,
    );

    // Build the SnappPay/TorobPay payment re-issue payload via the shared
    // assembler. Active installation lines (their summed amount == grandTotal)
    // join the cart so the breakdown stays complete; the assembler returns
    // undefined for non-BNPL gateways. `order.totalPrice` is already the reduced
    // (shipping/discount-aware) value set above, so it is the authoritative
    // `amount`. Same assembler is used by refundReserveShare's install-cancel path.
    const installLines =
      await this.installationReserveQueryService.getInstallationCartLinesForOrder(
        orderId,
        queryRunner.manager,
      );
    const reissueCart = this.assembleBnplReissueCart({
      cartId: order.id,
      paymentType: mainPaymentTransaction.paymentType,
      paymentToken: mainPaymentTransaction.extraInfo,
      amountToman: order.totalPrice,
      discountToman: order.discountAmount,
      shippingToman: shippingAndPackingCost,
      goodsLines: order.items
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          id: item.configId,
          name: item.config.carPart.name,
          count: item.quantity,
          amountToman: item.checkoutPrice,
        })),
      installLines,
    });

    // Dispatch the partial refund. editOrderThirdParty already computed and set
    // order.totalPrice (shipping/discount aware), so reduceTotalPrice=false to
    // avoid double-subtracting. RefundService now owns the diff transaction +
    // gateway dispatch:
    //  - SNAPP/TOROB → AUTO via reissueCart (re-issue reduced payment)
    //  - TARA/DIGI   → AUTO amount refund
    //  - SAMAN/EWANO/ZARINPLUS/AZKI → ManualRefundEntity (was a silent negative
    //    transaction before; now a tracked manual obligation)
    //  - KEEPA/ITOL  → no-op
    await this.refundService.refundPartial({
      order,
      amount: Math.abs(differenceTotalPrice),
      userId: order.userId,
      idempotencyKey: `RETURN-${uniqeId}`,
      manager: queryRunner.manager,
      callThirdParty,
      reduceTotalPrice: false,
      reissueCart,
    });

    return true;
  }

  async cancelOtherActiveOrders(userId: number, queryRunner: QueryRunner) {
    const orders = await queryRunner.manager.find(OrderEntity, {
      where: {
        userId,
      },
      relations: { payment: { transactions: true } },
    });

    queryRunner.manager.update(
      PaymentTransactionEntity,
      {
        id: In(
          orders
            .map((order) => order.payment)
            .flatMap((payment) => payment.transactions)
            .map((transaction) => transaction.id),
        ),
      },
      { state: PaymentTransactionState.EXPIRED },
    );
  }

  async addCommentOrderEvent(
    description: string,
    userId: number,
    orderId: number,
    parcelId: number,
    queryRunner: QueryRunner,
  ): Promise<boolean> {
    const orderEvent = new OrderEventEntity();
    orderEvent.type = OrderEventTypeEnum.COMMENT;
    orderEvent.userId = userId;
    orderEvent.orderId = orderId;
    orderEvent.parcelId = parcelId;
    orderEvent.description = description;

    await queryRunner.manager.save(OrderEventEntity, orderEvent);
    return true;
  }

  async addCommentOrderToOrder(
    description: string,
    userId: number,
    orderId: number,
    parcelId: number,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const order = await queryRunner.manager.findOne(OrderEntity, {
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    try {
      await this.addCommentOrderEvent(
        description,
        userId,
        orderId,
        parcelId,
        queryRunner,
      );

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Error will be logged centrally by AllExceptionsFilter
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getOrderEventsByOrderId(orderId: number): Promise<OrderEventEntity[]> {
    const events = await this.orderEventRepo.find({
      where: { orderId: orderId },
    });
    events.forEach((event) => {
      event.durationInState = JSON.stringify(event.durationInState);
    });

    return events;
  }

  async getOrderEventsByParcelId(
    parcelId: number,
  ): Promise<OrderEventEntity[]> {
    const events = await this.orderEventRepo.find({
      where: { parcelId: parcelId },
    });
    events.forEach((event) => {
      event.durationInState = JSON.stringify(event.durationInState);
    });

    return events;
  }

  async getOrderEventsByOrderIds(ids: readonly number[]) {
    try {
      const result = await this.orderEventRepo.find({
        where: { orderId: In([-1, ...ids]) },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  async getOrderEventsByParcelIds(ids: readonly number[]) {
    try {
      const result = await this.orderEventRepo.find({
        where: { parcelId: In([-1, ...ids]) },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  async getParcelsByOrderIds(ids: readonly number[]) {
    try {
      const result = await this.parcelRepo.find({
        where: { orderId: In([-1, ...ids]) },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  async getParcelsByIds(ids: readonly number[]) {
    try {
      const result = await this.parcelRepo.find({
        where: { id: In([-1, ...ids]) },
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  async getOrderByIds(ids: readonly number[]) {
    try {
      return this.repo.find({ where: { id: In([-1, ...ids]) } });
    } catch (error) {
      throw error;
    }
  }

  async getParcelByIds(ids: readonly number[]) {
    try {
      return this.parcelRepo.find({ where: { id: In([-1, ...ids]) } });
    } catch (error) {
      throw error;
    }
  }

  async getParcelById(id: number) {
    try {
      return this.parcelRepo.findOne({
        where: { id },
        relations: {
          order: {
            addressClone: true,
            items: { config: { carPart: true, supplier: true } },
            user: true,
          },
          physicalOrderItems: true,
        },
      });
    } catch (error) {
      throw error;
    }
  }
  async getParcelById2(id: number) {
    try {
      return this.parcelRepo.findOne({
        where: { id },
        relations: {
          order: {
            addressClone: true,
            user: true,
            items: true,
          },
          physicalOrderItems: {
            orderItem: true,
            physicalItem: { config: { carPart: true, supplier: true } },
          },
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async getOrderItemsByOrderItemIds(orderItemIds: readonly number[]) {
    const orderItem = await this.orderItemRepo.find({
      where: { id: In(orderItemIds) },
    });

    const order = await this.repo.find({
      where: { id: In(orderItem.map((item) => item.orderId)) },
      relations: ['items'],
    });
    return order;
  }

  async getPhysicalOrderItemsByPhysicalItemIds(
    physicalItemIds: readonly number[],
  ): Promise<PhysicalOrderItemEntity[]> {
    return await this.physicalOrderItemRepo.find({
      where: { physicalItemId: In(physicalItemIds) },
      relations: { physicalItem: true, parcel: { physicalOrderItems: true } },
    });
  }

  async getPhysicalOrderItemsByOrderId(
    orderId: number,
  ): Promise<PhysicalOrderItemEntity[]> {
    try {
      return await this.physicalOrderItemRepo
        .createQueryBuilder('physicalOrderItem')
        .innerJoin('physicalOrderItem.orderItem', 'orderItem')
        .where('orderItem.orderId = :orderId', { orderId })
        .andWhere('physicalOrderItem.parcelId IS NOT NULL')
        .getMany();
    } catch (error) {
      throw error;
    }
  }

  async getOrderCancellationsByOrderIds(orderIds: readonly number[]) {
    try {
      return this.orderCancellationRepo.find({
        where: { orderId: In([-1, ...orderIds]) },
      });
    } catch (error) {
      throw error;
    }
  }

  async addGovermentTire(
    userId: number,
    quantity: number,
    carPartId: number,
    orderId: number,
    queryRunner: QueryRunner,
  ) {
    const result = await queryRunner.manager.insert(OrderGovermentTiresEntity, {
      carPartId,
      userId,
      quantity,
      orderId,
    });
    return result;
  }

  async getDeliveryAndShipping(parcel: IParcel) {
    let deliveryText = '';
    if (parcel.deliveryDeadline) {
      deliveryText = this.getDeliveryDayText(
        parcel.deliveryDeadline,
        parcel.isExpressShipping || false,
      );
    }
    return deliveryText;
  }

  async logOrderEvent(
    state: ParcelStateEnum,
    description: string | null,
    userId: number,
    orderId: number,
    parcelId: number,
    queryRunner: QueryRunner,
    courier?: ParcelShippingCourier,
  ): Promise<void> {
    const oldOrderEvent = await queryRunner.manager.findOne(OrderEventEntity, {
      where: { orderId: orderId, type: OrderEventTypeEnum.LOG },
      order: { createdDate: 'DESC' },
    });

    if (oldOrderEvent) {
      const oldOrderEventDurationInState = Utils.calculateDurationInState(
        Date.now(),
        oldOrderEvent.createdDate.getTime(), //calc timestamp
      );

      await queryRunner.manager.update(
        OrderEventEntity,
        { id: oldOrderEvent.id },
        { durationInState: oldOrderEventDurationInState },
      );
    }

    const orderEvent = new OrderEventEntity();
    orderEvent.type = OrderEventTypeEnum.LOG;
    orderEvent.userId = userId;
    orderEvent.orderId = orderId;
    orderEvent.parcelId = parcelId;
    orderEvent.description = description;
    orderEvent.parcelState = state;
    orderEvent.shippingCourier = courier;

    await queryRunner.manager.save(OrderEventEntity, orderEvent);
  }

  async findOrderShippingBySupplierUsersIdAndCity(
    supplierUserIds: number[] | null,
    cityId: number,
    size: CarPartSize,
  ) {
    return await this.orderShippingRepo.find({
      where: {
        cityId,
        supplierUserId: In(supplierUserIds),
        size,
      },
    });
  }
  async findAllOrderShippingBysupplierUserIds(supplierUserIds: number[]) {
    return await this.orderShippingRepo.find({
      where: {
        supplierUserId: In(supplierUserIds),
      },
    });
  }

  getPaymentTypePersianName(paymentType: PaymentType): string {
    const translations: { [key in PaymentType]?: string } = {
      [PaymentType.DIGI_PAY]: 'دیجی پی',
      [PaymentType.EWANO]: 'اوانو',
      [PaymentType.ITOL]: 'آیتول',
      [PaymentType.SNAPP_PAY]: 'اسنپ پی',
      [PaymentType.TARA]: 'تارا',
      [PaymentType.TOROB_PAY]: 'ترب پی',
      [PaymentType.AZKI]: 'ازکی',
      [PaymentType.ZARINPLUS]: 'زرین پلاس',
    };

    return translations[paymentType] || 'پلتفرم';
  }

  async getUserGlobalDiscountUsageCount(
    userId: number,
    discountId: number,
  ): Promise<number> {
    const count = await this.repo
      .createQueryBuilder('order')
      .innerJoin(
        PaymentTransactionEntity,
        'paymentTransaction',
        'paymentTransaction.paymentId = order.paymentId',
      )
      .where('order.userId = :userId', { userId })
      .andWhere('order.discountId = :discountId', { discountId })
      .andWhere('paymentTransaction.state = :state', {
        state: PaymentTransactionState.SUCCESS,
      })
      .getCount();

    return count;
  }

  async getVibeRefundStatus(vibeOrderId: string) {
    const transaction = await this.dataSource
      .getRepository(PaymentTransactionEntity)
      .findOne({
        where: {
          transactionId: vibeOrderId,
          paymentType: PaymentType.VIBE,
          state: PaymentTransactionState.SUCCESS,
        },
      });
    if (!transaction) {
      throw new BadRequestException('تراکنش وایب با این شناسه یافت نشد');
    }
    return this.vibeService.getRefundStatusByOrderId(vibeOrderId);
  }
}
