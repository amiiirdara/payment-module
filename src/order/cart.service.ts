import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { CarPartService } from 'src/car-part/services/car-part.service';
import { Utils, WrapperType } from 'src/common/utils';

import { DataSource, In, IsNull, QueryRunner, Repository } from 'typeorm';
import { CarPartState } from 'types/enums';
import { CarPartSellState } from 'types/interfaces/car-part/car-part-config.interface';
import { CarPartConfigEntity } from 'src/car-part/entities/car-part-config.entity';
import { CartStateEnum, ICartItem } from 'types/interfaces/cart/cart.interface';
import { AbTestService } from '../ab-test/ab-test.service';
import { AbTestVariants } from '../ab-test/interfaces/ab-test.interface';

import { PaymentType } from 'types/interfaces/payment/payment.interface';

import { CreateShoppingCartDto, ShoppingCartBrief } from './dto/cart.dto';
import {
  CartInstallationBookingDto,
  CartItemsResponseDto,
} from './dto/cart-items-response.dto';

import { CartItemEntity } from './entities/cart-item.entity';
import { CartEntity } from './entities/cart.entity';

import { DomainNameEn } from 'types/enums/domain-name.enum';
import { AsyncLocalStorage } from 'async_hooks';

import { OrderGovermentTiresEntity } from './entities/order-goverment-tires.entity';
import { OrderService } from './order.service';
import { AddressService } from 'src/address/address.service';
import { LoggerService } from 'src/common/logger';
import { toError } from 'src/common/error.utils';
import { InstallationBookingEntity } from 'src/installation/entities/installation-booking.entity';
import { InstallationBookingService } from 'src/installation/services/installation-booking.service';
import { LocalInstallationBookingDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  private readonly MINIMUM_AMOUNT_FOR_FREE_SHIPPING =
    process.env.MINIMUM_AMOUNT_FOR_FREE_SHIPPING;

  constructor(
    private readonly logger: LoggerService,
    private readonly als: AsyncLocalStorage<any>,

    @InjectRepository(OrderGovermentTiresEntity)
    private readonly orderGovermentTireRepo: Repository<OrderGovermentTiresEntity>,

    @InjectRepository(CartEntity)
    private readonly cartRepo: Repository<CartEntity>,

    @InjectRepository(CartItemEntity)
    private readonly cartItemRepo: Repository<CartItemEntity>,

    @InjectRepository(InstallationBookingEntity)
    private readonly installationBookingRepo: Repository<InstallationBookingEntity>,

    private readonly carPartService: CarPartService,

    @Inject(forwardRef(() => OrderService))
    private readonly orderService: WrapperType<OrderService>,

    @Inject(forwardRef(() => AddressService))
    private addressService: WrapperType<AddressService>,

    @Inject(forwardRef(() => InstallationBookingService))
    private readonly installationBookingService: WrapperType<InstallationBookingService>,

    private readonly abTestService: AbTestService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async updateUserCart(
    userId: number,
    dto: CreateShoppingCartDto[],
    inStoreSupplierUserId?: number,
  ) {
    // debug: cart updates are frequent — keep prod info-level quiet (ADR-037).
    this.logger.debug('cart_update', 'CartService', {
      userId,
      itemCount: dto.length,
      inStoreSupplierUserId,
    });
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let myCart;

    try {
      // کار با CartEntity
      myCart = await queryRunner.manager.findOne(CartEntity, {
        where: {
          userId,
          state: In([CartStateEnum.ACTIVE]),
          ...(inStoreSupplierUserId ? { inStoreSupplierUserId } : {}),
        },
      });
      if (!myCart) {
        myCart = await queryRunner.manager.save(CartEntity, {
          state: CartStateEnum.ACTIVE,
          userId,
          domainNameEn: this.als.getStore()['domainName'].en as DomainNameEn,
          ...(inStoreSupplierUserId ? { inStoreSupplierUserId } : {}),
        });
      }

      // کار با CartItemEntity
      for (const item of dto) {
        // منطق به‌روزرسانی اقلام سبد خرید
        const config = await this.carPartService.getConfig(item.configId);
        if (!config) {
          throw new BadRequestException('config-not-found');
        }
        const carPart = await this.carPartService.getCarPartByIdBrief(
          config.carPartId,
        );
        if (!carPart) {
          throw new BadRequestException('car-part-not-found');
        }
        if (CarPartState.ENABLE !== carPart.state) {
          const disabledItems = await queryRunner.manager.findOne(
            CartItemEntity,
            {
              where: {
                cartId: myCart.id,
                configId: item.configId,
              },
            },
          );
          if (disabledItems) {
            await queryRunner.manager.delete(CartItemEntity, {
              configId: disabledItems.configId,
              cartId: disabledItems.id,
            });
          } else {
            throw new BadRequestException('car-part-state');
          }
        }
        if (item.quantity < 1) {
          await queryRunner.manager.delete(CartItemEntity, {
            configId: item.configId,
            cartId: myCart.id,
          });
        } else {
          if (item.quantity > config.maxOrderQuantity) {
            item.quantity = config.maxOrderQuantity;
          }
          if (item.quantity < config.minOrderQuantity) {
            item.quantity = config.minOrderQuantity;
          }
          const isMarketplace = Utils.isMarketPlace(config);

          // اگر موجودی برای نوع فروش مربوطه صفر باشد خطا برگردان
          if (
            (isMarketplace && config.sellerAvailableStock <= 0) ||
            (!isMarketplace && config.warehouseAvailableStock <= 0)
          ) {
            throw new BadRequestException('out-of-stock');
          }

          if (isMarketplace && item.quantity > config.sellerAvailableStock) {
            item.quantity = config.sellerAvailableStock;
          } else if (
            !isMarketplace &&
            item.quantity > config.warehouseAvailableStock
          ) {
            item.quantity = config.warehouseAvailableStock;
          }
          const prevItem = await queryRunner.manager.findOne(CartItemEntity, {
            where: {
              configId: item.configId,
              cartId: myCart.id,
            },
          });
          if (prevItem) {
            await queryRunner.manager
              .createQueryBuilder()
              .update(CartItemEntity)
              .set({
                quantity: item.quantity,
                isMarketplace,
              })
              .where('configId = :configId', { configId: item.configId })
              .andWhere('cartId = :cartId', { cartId: myCart.id })
              .andWhere(':quantity > 0', { quantity: item.quantity })
              .execute();
          } else {
            const cartItem = new CartItemEntity();
            cartItem.configId = item.configId;
            cartItem.quantity = item.quantity;
            cartItem.cartId = myCart.id;
            cartItem.isMarketplace = isMarketplace;
            await queryRunner.manager.save(CartItemEntity, cartItem);
          }
        }
      }
      myCart.showUpdatedAlert = false;
      myCart.updatedDate = new Date();
      await queryRunner.manager.save(CartEntity, myCart);
      await queryRunner.commitTransaction(); // اجرای موفقیت‌آمیز ترنزکشن
      return true;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err; // خطاها را برگردانید
    } finally {
      await queryRunner.release();
    }
  }

  async mergeCarts(
    userId: number,
    localCart: ShoppingCartBrief[],
    localInstallationBookings: LocalInstallationBookingDto[] = [],
  ): Promise<{
    result: boolean;
    showCartChangeWarningOnItemDisabled: boolean;
    showCartChangeWarningOnInstallationDisabled: boolean;
    installationItemsSkipped: number;
    installationItemsMerged: number;
  }> {
    let hasAnyMerged = false;
    let hasQuantityFilteredItems = false;

    for (const item of localCart) {
      try {
        // Load config to apply the same quantity and stock rules as updateUserCart
        const config = await this.carPartService.getConfig(item.configId);
        if (!config) {
          continue;
        }

        // Start with requested quantity
        let quantity = item.quantity;

        // Apply max/min order quantity rules
        if (quantity > config.maxOrderQuantity) {
          quantity = config.maxOrderQuantity;
        }
        if (quantity < config.minOrderQuantity) {
          quantity = config.minOrderQuantity;
        }

        const isMarketplace = Utils.isMarketPlace(config);
        const availableStock = isMarketplace
          ? config.sellerAvailableStock
          : config.warehouseAvailableStock;

        // If available stock is 0 or less, treat as quantity 0 and skip this item
        if (availableStock <= 0) {
          hasQuantityFilteredItems = true;
          continue;
        }

        // Clamp requested quantity to available stock
        if (quantity > availableStock) {
          quantity = availableStock;
        }

        // If after all rules quantity is < 1, do not add this item to cart
        if (quantity < 1) {
          hasQuantityFilteredItems = true;
          continue;
        }

        const dto: CreateShoppingCartDto = {
          configId: item.configId,
          quantity,
        };

        const result = await this.updateUserCart(userId, [dto]);
        if (result) {
          hasAnyMerged = true;
        }
      } catch (error) {
        // Log error for this specific item but continue with the rest
        this.logger.error(
          'cart_merge_item_failed',
          toError(error),
          'CartService',
          { userId, configId: item.configId },
        );
      }
    }

    // ─── Installation bookings merge ───────────────────────
    // Each local booking is replayed via InstallationBookingService.updateItem
    // — the SAME service the live flow calls — so every validation runs
    // unchanged (in-city, AMPT.state, technician.isActive, stock cap,
    // AMP-coherence, lead-time, day-grain guard). Failures per item are
    // swallowed and counted; success per item is counted. This mirrors the
    // goods loop above where we skip-and-count rather than throw.
    //
    // The booking-level `find-or-create` inside updateItem means that
    // multiple local items with the same (technician, startAt) collapse to
    // a single server-side InstallationBooking, exactly like the live flow.
    let installationItemsMerged = 0;
    let installationItemsSkipped = 0;
    let activeCartIdForInstall: number | null = null;
    if (localInstallationBookings.length > 0) {
      // The goods loop above only creates a cart when localCart had items. A
      // user who was logged out with ONLY installation bookings (no goods) has
      // no cart at this point, so create one here — otherwise every install
      // item would be skipped for lack of a cart to attach to.
      activeCartIdForInstall = await this.getOrCreateActiveCartId(userId);
    }
    if (activeCartIdForInstall !== null) {
      for (const booking of localInstallationBookings) {
        for (const item of booking.items) {
          try {
            await this.installationBookingService.updateItem(
              userId,
              activeCartIdForInstall,
              {
                amptId: item.amptId,
                carPartConfigId: item.carPartConfigId,
                quantity: item.quantity,
                startAt: booking.startAt,
              },
            );
            installationItemsMerged += 1;
          } catch (error) {
            installationItemsSkipped += 1;
            this.logger.error(
              'cart_merge_installation_item_failed',
              toError(error),
              'CartService',
              {
                userId,
                cartId: activeCartIdForInstall,
                amptId: item.amptId,
                startAt: booking.startAt,
              },
            );
          }
        }
      }
    }
    if (installationItemsMerged > 0) {
      hasAnyMerged = true;
    }

    return {
      result: hasAnyMerged,
      showCartChangeWarningOnItemDisabled: hasQuantityFilteredItems,
      showCartChangeWarningOnInstallationDisabled: installationItemsSkipped > 0,
      installationItemsSkipped,
      installationItemsMerged,
    };
  }

  async getCartItems(
    userId: number,
    abTestVariants?: AbTestVariants,
    inStoreSupplierUserId?: number,
  ): Promise<CartItemsResponseDto> {
    const isPickupInStore = inStoreSupplierUserId ? true : false;

    /*
    ماکس کالکت پریود داره توسط خود فرانت محاسبه میشه و این یک کامنت برای یاداوری هست
    */
    const minimumAmountForFreeShipping = this.MINIMUM_AMOUNT_FOR_FREE_SHIPPING;
    const myCart = await this.cartRepo.findOne({
      where: {
        userId,
        state: In([CartStateEnum.ACTIVE]),
        ...(isPickupInStore ? { inStoreSupplierUserId } : {}),
      },
    });
    if (!myCart) {
      return {
        minimumAmountForFreeShipping,
        cartItems: [],
        installationBookings: [],
      };
    }
    const cartItems = await this.cartItemRepo.find({
      where: {
        cartId: myCart.id,
      },
      select: {
        id: true,
        quantity: true,
        isMarketplace: true,
        config: {
          id: true,
          basePrice: true,
          minOrderQuantity: true,
          maxOrderQuantity: true,
          sellState: true,
          collectPeriod: true,
          prepTime: true,
          deliveryMethod: true,
          price: true,
          purchasePrice: true,
          isScrap: true,
          supportedPaymentGateways: true,
          sellerAvailableStock: true,
          warehouseAvailableStock: true,
          carPart: {
            id: true,
            url: true,
            name: true,
            state: true,
            isSpecial: true,
            technicalNumber: true,
            size: true,
            isTireDolati: true,
            joinCategories: {
              id: true,
              categoryId: true,
              category: { id: true },
            },
            images: {
              name: true,
              alt: true,
              image: true,
              order: true,
              size: true,
            },
            carPartMapping: {
              carBrand: true,
              carModel: true,
              carTip: true,
            },
          },
          supplier: {
            userId: true,
            title: true,
            url: true,
          },
        },
      },
      relations: {
        config: {
          carPart: {
            images: true,
            carPartMapping: true,
            joinCategories: { category: true },
          },
          supplier: true,
        },
      },
      order: {
        createdDate: 'desc',
        config: {
          carPart: {
            images: {
              order: 'ASC',
            },
          },
        },
      },
    });

    // Apply A/B Testing Logic for cart items
    const processedCartItems = cartItems.map((item) => {
      const pricingCfg = this.abTestService.getPricingConfig(
        item.configId,
        item.config.carPart.joinCategories[0].categoryId,
        abTestVariants,
      );
      const adjustedPrice = pricingCfg
        ? Utils.roundPrice(
            Math.ceil(item.config.price * pricingCfg.marginMultiplier),
            3,
          )
        : Utils.roundPrice(item.config.price, 3);
      const adjustedBasePrice = pricingCfg
        ? Utils.roundPrice(
            Math.ceil(item.config.basePrice * pricingCfg.marginMultiplier),
            3,
          )
        : Utils.roundPrice(item.config.basePrice, 3);

      return {
        quantity: item.quantity,
        isMarketplace: item.isMarketplace,
        config: {
          id: item.config.id,
          minOrderQuantity: item.config.minOrderQuantity,
          maxOrderQuantity: item.config.maxOrderQuantity,
          sellerAvailableStock: item.config.sellerAvailableStock,
          warehouseAvailableStock: item.config.warehouseAvailableStock,
          basePrice: Utils.calculatePricePerDomainAndCategory(
            this.als.getStore()['domainName'].en,
            item.config.carPart.joinCategories[0].categoryId,
            adjustedBasePrice,
          ),
          price: Utils.calculatePricePerDomainAndCategory(
            this.als.getStore()['domainName'].en,
            item.config.carPart.joinCategories[0].categoryId,
            isPickupInStore ? item.config.purchasePrice : adjustedPrice,
          ),
          sellState: item.config.sellState,
          collectPeriod: item.config.collectPeriod,
          prepTime: item.config.prepTime,
          deliveryMethod: item.config.deliveryMethod,
          size: item.config.carPart?.size,
          isScrap: item.config?.isScrap,
          supportedPaymentGateways: item.config.supportedPaymentGateways,
        },
        product: {
          ...item.config.carPart,
        },
        supplier: {
          ...item.config.supplier,
        },
      };
    });

    // Load installation bookings under the same cart (cart-side installation
    // sub-aggregate per ADR-009). Returns empty when no bookings exist; FE can
    // ignore the field if it doesn't render installation.
    //
    // `select` is explicit: never return the technician's sensitive columns
    // (phoneNumber, nationalCode, cardNumber, …) or the AMPC's internal columns
    // (purchasePrice, stock buckets, …) to the client. Only what the cart UI needs.
    const installationBookingRows = await this.installationBookingRepo.find({
      where: { cartId: myCart.id },
      select: {
        id: true,
        technicianUserId: true,
        startAt: true,
        endAt: true,
        technician: {
          userId: true,
          shopName: true,
          addressDescription: true,
          cityId: true,
          latitude: true,
          longitude: true,
          city: { id: true, name: true },
        },
        items: {
          id: true,
          carPartTechnicianId: true,
          carPartConfigId: true,
          quantity: true,
          // `inventory` is the technician's on-hand install capacity, surfaced to
          // the cart so the FE can cap the quantity. Sensitive AMPT columns
          // (phoneNumber, cardNumber, …) stay excluded by this whitelist.
          carPartTechnician: { id: true, serviceFee: true, inventory: true },
          carPartConfig: {
            id: true,
            price: true,
            sellerAvailableStock: true,
            warehouseAvailableStock: true,
            supportedPaymentGateways: true,
            carPart: {
              id: true,
              name: true,
              url: true,
              images: { id: true, image: true },
              joinCategories: { id: true, categoryId: true },
            },
          },
        },
      },
      relations: {
        technician: { city: true },
        items: {
          carPartTechnician: true,
          carPartConfig: { carPart: { images: true, joinCategories: true } },
        },
      },
      order: { startAt: 'ASC' },
    });

    const installationBookings = this.projectInstallationBookings(
      installationBookingRows,
      abTestVariants,
    );

    // Apply A/B Testing Logic and return processed cart items
    return {
      minimumAmountForFreeShipping,
      cartItems: processedCartItems,
      installationBookings,
    };
  }

  /**
   * Map cart installation bookings to a lean, client-safe shape — only the
   * fields the cart UI needs. Mirrors the guest-cart installation shape so the
   * FE has ONE installation-booking contract across guest and logged-in carts.
   *
   * Per item we expose the money components of the supply+install model:
   *  - serviceFee: AMPT install labor (per unit)
   *  - price:      the AMPC final part price (per unit), A/B + per-domain adjusted
   *  - basePrice:  the AMPC pre-discount part price (per unit), same adjustment
   *    exactly like goods cart items. No gateway fee here — that is added at
   *    checkout based on the chosen payment type (same as goods). FE renders the
   *    discount as price vs basePrice.
   */
  private projectInstallationBookings(
    bookings: InstallationBookingEntity[],
    abTestVariants?: AbTestVariants,
  ): CartInstallationBookingDto[] {
    const domainEn = this.als.getStore()['domainName'].en;
    return bookings.map((b) => ({
      id: b.id,
      technicianUserId: b.technicianUserId,
      startAt: b.startAt,
      endAt: b.endAt,
      technician: b.technician
        ? {
            userId: b.technician.userId,
            shopName: b.technician.shopName,
            addressDescription: b.technician.addressDescription,
            cityId: b.technician.cityId,
            cityName: b.technician.city?.name ?? null,
            latitude: b.technician.latitude,
            longitude: b.technician.longitude,
          }
        : null,
      items: (b.items ?? []).map((item) => {
        const config = item.carPartConfig;
        const carPart = config?.carPart;
        const categoryId = carPart?.joinCategories?.[0]?.categoryId;

        // A/B + per-domain pricing, same as goods cart items. Falls back to the
        // raw prices if the part has no category (no A/B/domain adjustment).
        // price and basePrice go through the identical transform so the FE's
        // discount ratio (price vs basePrice) stays correct.
        let price = Utils.roundPrice(config?.price ?? 0, 3);
        let basePrice = Utils.roundPrice(config?.basePrice ?? 0, 3);
        if (categoryId != null) {
          const pricingCfg = this.abTestService.getPricingConfig(
            config.id,
            categoryId,
            abTestVariants,
          );
          const marginMultiplier = pricingCfg?.marginMultiplier ?? null;
          price = Utils.adjustCartPrice(
            config.price ?? 0,
            marginMultiplier,
            domainEn,
            categoryId,
          );
          basePrice = Utils.adjustCartPrice(
            config.basePrice ?? 0,
            marginMultiplier,
            domainEn,
            categoryId,
          );
        }

        return {
          id: item.id,
          // API boundary: response field stays `amptId`, sourced from the renamed column.
          amptId: item.carPartTechnicianId,
          carPartConfigId: item.carPartConfigId,
          quantity: item.quantity,
          inventory: item.carPartTechnician?.inventory ?? 0,
          sellerAvailableStock: config?.sellerAvailableStock ?? 0,
          warehouseAvailableStock: config?.warehouseAvailableStock ?? 0,
          serviceFee: item.carPartTechnician?.serviceFee ?? 0,
          price,
          basePrice,
          isMarketplace: config ? Utils.isMarketPlace(config) : false,
          supportedPaymentGateways: config?.supportedPaymentGateways ?? [],
          product: {
            id: carPart?.id ?? null,
            name: carPart?.name ?? null,
            url: carPart?.url ?? null,
            image: carPart?.images?.[0]?.image ?? null,
          },
        };
      }),
    }));
  }

  /**
   * The AMPC (CarPartConfig) of every installation booking item in a cart, with
   * the fields the payment-gateway computation needs: supportedPaymentGateways
   * (to intersect available gateways), carPart.joinCategories.category (category
   * ids → per-gateway fee), and price/purchasePrice. Because the reserve is
   * "supply + install", these parts are billed too, so they count toward the
   * gateway intersection and the fee exactly like goods.
   */
  async getCartInstallationBillingConfigs(
    cartId: number,
  ): Promise<{ config: CarPartConfigEntity; quantity: number }[]> {
    const bookings = await this.installationBookingRepo.find({
      where: { cartId },
      relations: {
        items: {
          carPartConfig: { carPart: { joinCategories: { category: true } } },
        },
      },
    });
    return bookings.flatMap((b) =>
      (b.items ?? []).map((it) => ({
        config: it.carPartConfig,
        quantity: it.quantity,
      })),
    );
  }

  async getCrossSalePartsForUser(
    userId: number,
    abTestVariants?: AbTestVariants,
  ) {
    const cartItems = await this.getCartItems(userId, abTestVariants);
    const cartItemsProductIds = cartItems.cartItems.map((cartItem) => {
      return cartItem.product.id;
    });
    return this.carPartService.getCrossSaleParts(cartItemsProductIds);
  }

  async checkGovermentTire(
    userId: number,
    newNumberOfGovermentItemsPurchased: number,
  ) {
    let numberOfGovermentItemsPurchased = 0;

    if (newNumberOfGovermentItemsPurchased > 100) {
      return {
        success: false,
        numberOfGovermentItemsPurchased,
      };
    }

    const orders = await this.orderGovermentTireRepo.find({
      where: { userId },
    });

    orders.forEach((element) => {
      numberOfGovermentItemsPurchased += element.quantity;
    });

    if (
      numberOfGovermentItemsPurchased >= 100 ||
      numberOfGovermentItemsPurchased + newNumberOfGovermentItemsPurchased > 100
    ) {
      return {
        success: false,
        numberOfGovermentItemsPurchased,
      };
    }

    return {
      success: true,
      numberOfGovermentItemsPurchased,
    };
  }

  /**
   * Validates cart items with common logic shared between regular validation and pickup-in-store validation.
   *
   * @param cartItems - The cart items to validate
   * @param userId - The user ID for government tire checks
   * @param currentGateway - The payment gateway to validate against
   * @param cartId - The cart ID for updating invalid items alert
   * @param shippingOptions - Validation options with conditional requirements based on validateShipping
   * @returns Promise resolving to valid cart items
   */
  private async validateCartItemsCore(
    cartItems: CartItemEntity[],
    userId: number,
    currentGateway: PaymentType,
    cartId: number,
    shippingOptions:
      | {
          validateShipping: true;
          cityId: number;
          provinceId: number;
        }
      | {
          validateShipping: false;
        },
  ): Promise<CartItemEntity[]> {
    const validItems: CartItemEntity[] = [];
    const carPartIdTireDolati: number[] = [];
    const invalidItemMessages: string[] = [];

    for (const item of cartItems) {
      const productName =
        item.config?.carPart?.name || `محصول #${item.configId}`;

      // Evaluate each condition independently to report specific violations
      const isAvailable = item.config.sellState === CarPartSellState.AVAILABLE;
      const hasSufficientStock = item.isMarketplace
        ? item.config.sellerAvailableStock >= item.quantity
        : item.config.warehouseAvailableStock >= item.quantity;
      const hasValidPrice = item.config.price > 0;

      const isShipable = shippingOptions.validateShipping
        ? await this.orderService.canShipConfigToCity(
            item.config,
            shippingOptions.cityId,
            shippingOptions.provinceId,
          )
        : true;

      const isValid =
        isAvailable && hasSufficientStock && hasValidPrice && isShipable;

      if (isValid) {
        validItems.push(item);
      } else {
        const reasons: string[] = [];
        if (!isAvailable) reasons.push('در حال حاضر قابل فروش نیست');
        if (!hasSufficientStock) reasons.push('موجودی کافی ندارد');
        if (!hasValidPrice) reasons.push('قیمت معتبر ندارد');
        if (!isShipable) reasons.push('امکان ارسال به شهر انتخابی وجود ندارد');

        invalidItemMessages.push(`${productName}: ${reasons.join('، ')}`);
        await this.cartItemRepo.delete({ id: item.id });
      }

      // Validate payment gateway compatibility (per-config)
      if (
        item.config.supportedPaymentGateways &&
        !item.config.supportedPaymentGateways.includes(currentGateway)
      ) {
        throw new BadRequestException(
          'محصولات انتخابی در سبد خرید با درگاه انتخاب شده همخوانی ندارد',
        );
      }

      // Collect tire dolati IDs
      if (item?.config?.carPart?.isTireDolati) {
        for (let i = 0; i < item.quantity; i++) {
          carPartIdTireDolati.push(item?.config?.carPart?.id);
        }
      }
    }

    // Handle invalid items
    if (invalidItemMessages.length > 0) {
      await this.cartRepo.update({ id: cartId }, { showUpdatedAlert: true });
      throw new BadRequestException(
        `موارد زیر از سبد خرید حذف شدند:\n${invalidItemMessages.join('\n')}`,
      );
    }

    // Check government tire limits
    if (carPartIdTireDolati.length > 0) {
      const check = await this.checkGovermentTire(
        userId,
        carPartIdTireDolati.length,
      );
      if (!check.success) {
        throw new BadRequestException(
          'امکان خرید بیش از 100 حلقه لاستیک دولتی در سال وجود ندارد',
        );
      }
    }

    return validItems;
  }

  /**
   * Updates the user's cart when their city changes by removing items that cannot be shipped to the new location.
   *
   * @param userId - The ID of the user whose cart needs to be updated
   * @param cityId - The ID of the new city to validate shipping availability against
   * @param queryRunner - Database query runner for transaction management
   * @returns A promise that resolves to {hasChanges: boolean, batteryRemoved: boolean}
   *
   * @example
   * ```typescript
   * const result = await cartService.updateCartFromCityChange(123, 456, queryRunner);
   * if (result.hasChanges) {
   *   console.log('Some items were removed from cart due to shipping restrictions');
   * }
   * if (result.batteryRemoved) {
   *   console.log('Battery items were removed from cart');
   * }
   * ```
   */
  async updateCartFromCityChange(
    userId: number,
    cityId: number,
    queryRunner: QueryRunner,
  ): Promise<{
    hasChanges: boolean;
    // goods-only signal: true iff at least one GOODS item was deleted because it
    // can't ship to the new city. Kept separate from hasChanges (which also
    // flips on installation removals) so callers can surface a goods-specific
    // warning that lines up with the guest cart's showCartChangeWarningOnCityChange.
    goodsRemoved: boolean;
    batteryRemoved: boolean;
    removedBatteryAmper: string | null;
    installationBookingsRemoved: number;
  }> {
    const cart = await this.getActiveCart(userId, queryRunner);

    const provinceId =
      this.addressService.getProvineIdOnAdressCityDataBycityId(cityId);

    let hasChanges = false;
    let goodsRemoved = false;
    let batteryRemoved = false;
    let removedBatteryAmper: string | null = null;
    let installationBookingsRemoved = 0;

    for (const item of cart.items) {
      // TODO: optimize by bulk check
      const isShipableToCity = await this.orderService.canShipConfigToCity(
        item.config,
        cityId,
        provinceId,
      );
      if (!isShipableToCity) {
        // Check if the removed item is a battery before deleting
        if (Utils.isBatteryProduct(item.config.carPart.attributes)) {
          batteryRemoved = true;
          removedBatteryAmper = item.config.carPart.attributes['آمپر'];
        }
        await queryRunner.manager.delete(CartItemEntity, { id: item.id });
        goodsRemoved = true;
        hasChanges = true;
      }
    }

    // Installation feature: installation is city-bound — the user must travel
    // to the technician's workshop, so the AMPT is only valid when
    // `technician.cityId === user.currentCityId`. When the user switches city
    // we drop every booking whose technician is no longer in-city (CASCADE
    // takes care of the line items).
    //
    // We drop the **whole booking** (not individual items) because the booking
    // is grain `(cart, technician, day)` — by definition every item under a
    // booking shares the technician, so the city check applies uniformly.
    const bookings = await queryRunner.manager.find(InstallationBookingEntity, {
      where: { cartId: cart.id },
      relations: { technician: true },
    });
    for (const booking of bookings) {
      if (booking.technician?.cityId !== cityId) {
        await queryRunner.manager.delete(InstallationBookingEntity, {
          id: booking.id,
        });
        installationBookingsRemoved += 1;
        hasChanges = true;
      }
    }

    return {
      hasChanges,
      goodsRemoved,
      batteryRemoved,
      removedBatteryAmper,
      installationBookingsRemoved,
    };
  }

  async validateCartItems(
    cartId: number,
    userId: number,
    addressCity: string,
    cityId: number,
    provinceId: number,
    currentGateway: PaymentType,
  ): Promise<CartItemEntity[]> {
    const cartItems = await this.cartItemRepo.find({
      where: {
        cartId,
      },
      relations: {
        config: {
          carPart: {
            joinCategories: {
              category: true,
            },
          },
        },
      },
    });

    return this.validateCartItemsCore(
      cartItems,
      userId,
      currentGateway,
      cartId,
      {
        validateShipping: true,
        cityId,
        provinceId,
      },
    );
  }

  async validateCartItemsForPickupInStore(
    cartId: number,
    userId: number,
    currentGateway: PaymentType,
  ): Promise<CartItemEntity[]> {
    const cartItems = await this.cartItemRepo.find({
      where: {
        cartId,
      },
      relations: {
        config: {
          carPart: {
            joinCategories: {
              category: true,
            },
          },
        },
      },
    });

    return this.validateCartItemsCore(
      cartItems,
      userId,
      currentGateway,
      cartId,
      {
        validateShipping: false,
      },
    );
  }

  async getCartUpdatedAlert(userId: number) {
    const myCart = await this.cartRepo.findOne({
      where: {
        userId,
        state: In([CartStateEnum.ACTIVE]),
      },
      select: {
        id: true,
        showUpdatedAlert: true,
      },
    });
    if (!myCart) {
      return false;
    }
    // dont want to show alert afert first time showed
    if (myCart?.showUpdatedAlert) {
      await this.cartRepo.update(
        { id: myCart.id },
        { showUpdatedAlert: false },
      );
    }
    return myCart.showUpdatedAlert;
  }

  async getCartItemsGQL(userId: number) {
    const myCart = await this.cartRepo.findOne({
      where: {
        userId,
        state: In([CartStateEnum.ACTIVE]),
      },
      order: {
        id: 'desc',
      },
    });
    if (!myCart) {
      return [];
    }
    const cartItems = await this.cartItemRepo.find({
      where: {
        cartId: myCart.id,
      },
    });
    return cartItems;
  }

  async getActiveCart(
    userId: number,
    queryRunner?: QueryRunner,
    inStoreSupplierUserId?: number,
    abTestVariants?: AbTestVariants,
  ): Promise<CartEntity> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(CartEntity)
      : this.cartRepo;

    const cart = await repo.findOne({
      where: {
        userId,
        state: In([CartStateEnum.ACTIVE]),
        ...(inStoreSupplierUserId ? { inStoreSupplierUserId } : {}),
      },
      relations: {
        items: {
          config: {
            carPart: { images: true, joinCategories: { category: true } },
            supplier: true,
          },
        },
      },
      order: {
        id: 'desc',
      },
    });

    if (!cart) {
      throw new BadRequestException('No active cart found');
    }

    if (abTestVariants && cart.items?.length > 0) {
      for (const item of cart.items) {
        const categoryId =
          item.config?.carPart?.joinCategories?.[0]?.categoryId;
        if (categoryId == null) continue;

        const pricingCfg = this.abTestService.getPricingConfig(
          item.configId,
          categoryId,
          abTestVariants,
        );
        item.config.price = pricingCfg
          ? Utils.roundPrice(
              Math.ceil(item.config.price * pricingCfg.marginMultiplier),
              3,
            )
          : Utils.roundPrice(item.config.price, 3);
        item.config.basePrice = pricingCfg
          ? Utils.roundPrice(
              Math.ceil(item.config.basePrice * pricingCfg.marginMultiplier),
              3,
            )
          : Utils.roundPrice(item.config.basePrice, 3);
      }
    }

    return cart;
  }

  /**
   * Resolve the user's active (non-in-store-supplier) cart id, or throw.
   *
   * This is the internal helper that other modules use when they need to
   * bind a cart-scoped operation (e.g. installation booking add/remove) to
   * the user's currently active cart without re-implementing the active-cart
   * lookup. Returns id only, no relations, no AB test pricing — designed to
   * be called from many service paths cheaply.
   */
  async getActiveCartIdOrFail(
    userId: number,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const cartId = await this.getActiveCartIdOrNull(userId, queryRunner);
    if (cartId == null) {
      throw new BadRequestException(
        'No active cart found. Add a goods item first.',
      );
    }
    return cartId;
  }

  /**
   * Like `getActiveCartIdOrFail` but returns null instead of throwing when the
   * user has no active cart. Used by read paths where "no cart yet" is normal
   * (e.g. slot availability before the first add-to-cart).
   */
  async getActiveCartIdOrNull(
    userId: number,
    queryRunner?: QueryRunner,
  ): Promise<number | null> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(CartEntity)
      : this.cartRepo;
    const cart = await repo.findOne({
      where: {
        userId,
        state: CartStateEnum.ACTIVE,
        inStoreSupplierUserId: IsNull(),
      },
      select: { id: true },
    });
    return cart?.id ?? null;
  }

  /**
   * Resolve the user's active cart id, creating an empty ACTIVE cart when none
   * exists yet.
   *
   * Needed by paths that must bind to a cart even when the user has NO goods
   * items — notably the login-time merge: a user who was logged out with only
   * installation bookings (no goods) never triggers the goods loop's inline
   * cart creation, so without this they'd have no cart to attach the bookings
   * to and every installation item would be skipped.
   *
   * Mirrors the inline create in `updateUserCart` (same state/userId/domain).
   */
  async getOrCreateActiveCartId(
    userId: number,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const existingId = await this.getActiveCartIdOrNull(userId, queryRunner);
    if (existingId != null) {
      return existingId;
    }
    const repo = queryRunner
      ? queryRunner.manager.getRepository(CartEntity)
      : this.cartRepo;
    const cart = await repo.save({
      state: CartStateEnum.ACTIVE,
      userId,
      domainNameEn: this.als.getStore()['domainName'].en as DomainNameEn,
    });
    return cart.id;
  }

  calculateItemFeeAmount(
    item: ICartItem,
    feeMapWithJoinIds: Map<
      number,
      { feePercent: number; dpgCatJoinId: number }
    >,
    itemPricePerDomain: number,
    abTestVariants?: AbTestVariants,
  ): number {
    const { feePercent: baseFeePercent, dpgCatJoinId } =
      this.orderService.getItemFeePercentAndJoinId(item, feeMapWithJoinIds);
    const hasFee = dpgCatJoinId !== undefined;
    const markupCfg = this.abTestService.getMarkupOverride(
      dpgCatJoinId,
      abTestVariants,
    );
    const itemFeePercent =
      markupCfg !== null ? markupCfg.feePercent : baseFeePercent;
    return this.orderService.calculateItemFee(
      itemPricePerDomain,
      1,
      itemFeePercent,
      hasFee,
    );
  }

  async calculateCartItemsTotalPrice(
    items: ICartItem[],
    paymentType: PaymentType,
    abTestVariants?: AbTestVariants,
  ): Promise<{
    cartItemsTotalPrice: number;
    cartItemsTotalPriceWithFee: number;
  }> {
    const categoryIds = Utils.extractCarPartCategoryIds(items);
    const domainNameEn = this.als.getStore()['domainName'].en as DomainNameEn;
    const feeMapWithJoinIds =
      await this.orderService.getPaymentGatewayFeeWithJoinIds(
        categoryIds,
        paymentType,
        domainNameEn,
      );

    let cartItemsTotalPrice = 0;
    let cartItemsTotalPriceWithFee = 0;

    for (const item of items) {
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

      const itemPricePerDomain = Utils.calculatePricePerDomainAndCategory(
        this.als.getStore()['domainName'].en,
        item.config.carPart.joinCategories[0].categoryId,
        itemPrice,
      );

      const itemFee = this.calculateItemFeeAmount(
        item,
        feeMapWithJoinIds,
        itemPricePerDomain,
        abTestVariants,
      );

      cartItemsTotalPrice += itemPricePerDomain * item.quantity;
      cartItemsTotalPriceWithFee +=
        (itemPricePerDomain + itemFee) * item.quantity;
    }

    return { cartItemsTotalPrice, cartItemsTotalPriceWithFee };
  }

  async calculateCartItemsTotalFeeAmount(
    items: ICartItem[],
    paymentType: PaymentType,
    abTestVariants?: AbTestVariants,
  ): Promise<number> {
    const categoryIds = Utils.extractCarPartCategoryIds(items);
    const domainNameEn = this.als.getStore()['domainName'].en as DomainNameEn;
    const feeMapWithJoinIds =
      await this.orderService.getPaymentGatewayFeeWithJoinIds(
        categoryIds,
        paymentType,
        domainNameEn,
      );

    let totalFeeAmount = 0;

    for (const item of items) {
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

      const itemPricePerDomain = Utils.calculatePricePerDomainAndCategory(
        this.als.getStore()['domainName'].en,
        item.config.carPart.joinCategories[0].categoryId,
        itemPrice,
      );

      const itemFee = this.calculateItemFeeAmount(
        item,
        feeMapWithJoinIds,
        itemPricePerDomain,
        abTestVariants,
      );

      totalFeeAmount += itemFee * item.quantity;
    }

    return totalFeeAmount;
  }

  async calculateTotalPriceFromItemsPickupInStore(
    items: ICartItem[],
    paymentType: PaymentType,
    abTestVariants?: AbTestVariants,
  ) {
    const categoryIds = Utils.extractCarPartCategoryIds(items);
    const domainNameEn = this.als.getStore()['domainName'].en as DomainNameEn;
    const feeMapWithJoinIds =
      await this.orderService.getPaymentGatewayFeeWithJoinIds(
        categoryIds,
        paymentType,
        domainNameEn,
      );

    return items.reduce((acc, item) => {
      const pricingCfg = this.abTestService.getPricingConfig(
        item.configId,
        item.config.carPart.joinCategories[0].categoryId,
        abTestVariants,
      );
      const itemPrice = pricingCfg
        ? Utils.roundPrice(
            Math.ceil(item.config.purchasePrice * pricingCfg.marginMultiplier),
            3,
          )
        : Utils.roundPrice(item.config.purchasePrice, 3);

      const itemPricePerDomain = Utils.calculatePricePerDomainAndCategory(
        this.als.getStore()['domainName'].en,
        item.config.carPart.joinCategories[0].categoryId,
        itemPrice,
      );

      const { feePercent: baseFeePercent, dpgCatJoinId } =
        this.orderService.getItemFeePercentAndJoinId(item, feeMapWithJoinIds);
      const hasFee = dpgCatJoinId !== undefined;
      const markupCfg = this.abTestService.getMarkupOverride(
        dpgCatJoinId,
        abTestVariants,
      );
      const itemFeePercent =
        markupCfg !== null ? markupCfg.feePercent : baseFeePercent;
      const itemFee = this.orderService.calculateItemFee(
        itemPricePerDomain,
        1,
        itemFeePercent,
        hasFee,
      );

      const itemTotalPrice = (itemPricePerDomain + itemFee) * item.quantity;
      return acc + itemTotalPrice;
    }, 0);
  }

  async deactivateCart(userId: number): Promise<boolean> {
    const result = await this.cartRepo.update(
      {
        userId,
        state: CartStateEnum.ACTIVE,
      },
      { state: CartStateEnum.INACTIVE },
    );

    if (result.affected === 0) {
      throw new BadRequestException('No active cart found');
    }

    return true;
  }
}
