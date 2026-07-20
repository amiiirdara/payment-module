# بررسی مهندسی: ثبت نهایی سفارش و تأیید پرداخت

بررسی بر اساس کد پروداکشن داخل ریپو، با تمرکز روی دو تابع اصلی:
- ثبت نهایی سبد خرید → `order.controller.ts` خط ۲۵۱، `order.service.ts` خط ۴۹۴۷
- تأیید پرداخت (کال‌بک همه درگاه‌ها) → `order.service.ts` خط ۱۸۹۹

---

## نقاط قوت

### ۱. تفکیک درست زمان کم‌کردن موجودی

در مرحله ثبت سفارش، رزرو نصب ساخته می‌شود ولی موجودی کالا کم نمی‌شود. کم‌کردن موجودی عمداً به بعد از تأیید پرداخت موکول شده. این تصمیم برای مسیر پولی درست است.

📎 مرجع — تأخیر عمدی کم‌کردن موجودی در ثبت سفارش:

```5106:5109:src/order/order.service.ts
      // Create installation reserves (state PAYMENT_PENDING_INSTALLATION) from
      // the validated bookings, inside this transaction. Inventory is NOT
      // decremented here — that happens in verifyOrder once payment confirms
      // (decision α-3, _design §0).
```

📎 مرجع — کم‌کردن موجودی بعد از تأیید پرداخت:

```2868:2874:src/order/order.service.ts
          if (!isPickupInStore) {
            await this.reduceConfigQuantities(order.items, queryRunner);
            // State transition: goods stock decremented after paid verify.
            this.logger.log('order_inventory_decremented', 'OrderService', {
              orderId: order.id,
              itemCount: order.items.length,
            });
```

---

### ۲. قابلیت ردیابی و مشاهده‌پذیری خوب

لاگ‌های مرحله‌ای، پاک‌سازی داده‌های حساس قبل از لاگ، شمارنده‌های قیف خرید و ارجاع به تصمیم‌های معماری نشان می‌دهد تیم مسیر را قابل بازسازی کرده.

📎 مرجع — لاگ شروع ثبت سفارش:

```4966:4975:src/order/order.service.ts
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
```

📎 مرجع — لاگ دریافت کال‌بک درگاه + پاک‌سازی داده حساس:

```2002:2009:src/order/order.service.ts
      // Forensics (ADR-037): one sanitized entry event per gateway callback —
      // the exact input the gateway sent us, queryable by transactionId.
      this.logger.log('gateway_callback_received', 'OrderService', {
        paymentType,
        transactionId,
        callback_body: this.sanitizeGatewayCallback(req.body),
        callback_query: this.sanitizeGatewayCallback(req.query),
      });
```

```1890:1896:src/order/order.service.ts
  private sanitizeGatewayCallback(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      out[k] = /pan|card/i.test(k) ? '***' : v;
    }
    return out;
```

📎 مرجع — شمارنده قیف خرید (شروع پرداخت و تأیید نهایی):

```5290:5297:src/order/order.service.ts
      // Funnel: the order (and its payment/gateway create) is now durably
      // committed — this is the trustworthy "payment initiated" moment
      // (emitting earlier, pre-commit, counted orders that later rolled back).
      checkoutFunnelTotal.inc({
        domain: order.domainNameEn ?? 'unknown',
        stage: 'payment_initiated',
        order_type: 'delivery',
      });
```

```2985:2990:src/order/order.service.ts
      if (!failedPaymentFlag) {
        checkoutFunnelTotal.inc({
          domain: order.domainNameEn ?? 'unknown',
          stage: 'payment_verified',
          order_type: order.addressClone ? 'delivery' : 'pickup',
        });
```

---

### ۳. پوشش تکرار درخواست برای پرداخت موفق

اگر تراکنش قبلاً موفق ثبت شده باشد، سیستم دوباره سبد را خراب نمی‌کند و کاربر را به صفحه نتیجه هدایت می‌کند.

📎 مرجع:

```2641:2660:src/order/order.service.ts
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
```

---

### ۴. اعتبارسنجی قیمت در سرور

مبلغ نهایی در سرور محاسبه و با مبلغ ارسالی کلاینت مقایسه می‌شود.

📎 مرجع — فراخوانی در ثبت سفارش:

```5179:5184:src/order/order.service.ts
      OrderUtils.validateTotalPriceAgainstDto(finalTotalPrice, dto.totalPrice, {
        cartTotal: cartItemsTotalPriceWithFee,
        shippingCost: totalShippingCost,
        packingCost: totalPackingCost,
        discountAmount: discountAmount,
      });
```

📎 مرجع — منطق مقایسه:

```11:24:src/order/utils.ts
  static validateTotalPriceAgainstDto(
    calculatedTotalPrice: number,
    dtoTotalPrice: number,
    breakdown?: {
      cartTotal?: number;
      shippingCost?: number;
      packingCost?: number;
      discountAmount?: number;
    },
  ) {
    if (calculatedTotalPrice !== dtoTotalPrice) {
      const lines: string[] = [
        `قیمت کل وارد شده معتبر نیست. قیمت دریافتی: ${dtoTotalPrice}، قیمت محاسبه‌شده: ${calculatedTotalPrice}`,
      ];
```

---

### ۵. مسیر سفارش با مبلغ صفر

برای سفارش‌های رایگان، بدون رفتن به درگاه، همان مسیر تأیید پرداخت با تراکنش پایگاه‌داده مشترک اجرا می‌شود.

📎 مرجع:

```5186:5253:src/order/order.service.ts
      // If total is 0, process order as verified without going to gateway
      if (finalTotalPrice === 0) {
        // Create payment and payment transaction with SUCCESS state
        const payment = new PaymentEntity();
        // ...
        paymentTransaction.state = PaymentTransactionState.SUCCESS;
        // ...
        const mockReq = {
          body: {
            // ...
            skipThirdparty: true,
          },
          // ...
        } as unknown as Request;
        // ...
        return await this.verifyOrder(
          mockReq,
          res,
          dto.paymentType,
          userId,
          queryRunner, // Pass existing queryRunner
        );
      }
```

---

## نقاط ضعف و ریسک‌ها

### ۱. مرز امنیت پولی شل است — بالاترین ریسک

پرچم «دور زدن درگاه» مستقیماً از بدنه درخواست خوانده می‌شود. بیشتر آدرس‌های تأیید پرداخت عمومی‌اند و نیاز به احراز هویت ندارند. اگر این پرچم فعال شود، تأیید درگاه رد می‌شود و مسیر موفقیت (تسویه سبد، ثبت موفق تراکنش، ساخت اقلام، کم‌کردن موجودی) اجرا می‌شود.

📎 مرجع — خواندن پرچم از بدنه درخواست (برای همه درگاه‌ها):

```1929:1947:src/order/order.service.ts
        case PaymentType.SAMAN:
          transactionId = String(req.body.ResNum);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;
        // ...
        case PaymentType.ZARINPAL:
          transactionId = String(req.query.Authority);
          skipThirdparty = Boolean(req.body.skipThirdparty);
          break;
```

📎 مرجع — با پرچم فعال، تأیید درگاه رد می‌شود:

```2088:2088:src/order/order.service.ts
            if (skipThirdparty) break;
```

📎 مرجع — endpointهای عمومی تأیید (بدون احراز هویت):

```126:148:src/order/order.controller.ts
  @Get('verify') // it's actually zarinpal-verify
  async test(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.ZARINPAL);
  }

  @Post('snappay-verify')
  async verifySnappPay(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.SNAPP_PAY);
  }
  // ...
  @Post('tara-verify')
  async verifyTara(@Req() req: Request, @Res() res: Response) {
    return this.service.verifyOrder(req, res, PaymentType.TARA);
  }
```

📎 مرجع — برگرداندن شناسه تراکنش و سفارش به کلاینت:

```5341:5349:src/order/order.service.ts
      if (!taraIpgPurchaseData) {
        res.status(200).json({
          success: true,
          url: paymentPageUrl,
          ewanoOrderId: transactionId || '',
          itolTransactionId: transactionId || '',
          orderId: order.id,
        });
        return;
      }
```

---

### ۲. تراکنش پایگاه‌داده دور تماس با درگاه پیچیده شده

تابع تأیید پرداخت اول تراکنش را باز می‌کند، بعد با درگاه تماس می‌گیرد، بعد عملیات سنگین انجام می‌دهد. برگشت تراکنش پایگاه‌داده، پول درگاه را برنمی‌گرداند.

📎 مرجع — شروع تراکنش:

```1910:1913:src/order/order.service.ts
    if (shouldManageTransaction) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }
```

📎 مرجع — تماس با درگاه داخل همان تراکنش (مثال سامان):

```2089:2092:src/order/order.service.ts
            if (this.saman.wasPaymentSuccessfull(req)) {
              const [status, RRN] = await this.saman.verifyPayment(req);
              trackingNumber = String(RRN);
```

📎 مرجع — عملیات سنگین بعد از تأیید (مهلت ارسال، ظرفیت، اقلام فیزیکی):

```2727:2816:src/order/order.service.ts
              const deadline = await this.calculateDeadline(
                // ...
              );
              // ...
              await this.processCapacityService.allocateCapacity(
                deadline,
                1,
                queryRunner,
              );
              // ...
              await this.physicalItemService.createPhysicalItemForVerifyOrder(
                orderItem,
                parcel,
                isPickupInStore,
                queryRunner,
              );
```

📎 مرجع — برگشت تراکنش در خطا (بدون جبران درگاه):

```3009:3012:src/order/order.service.ts
    } catch (error) {
      if (shouldManageTransaction) {
        await queryRunner.rollbackTransaction();
      }
```

---

### ۳. جبران خطا عمداً غیرفعال است

تابع جبران وجود دارد، ولی در مسیر شکست کامنت شده. بررسی موقت موجودی هم قبل از تأیید درگاه، پرداخت را ناموفق می‌کند بدون بازپرداخت خودکار.

📎 مرجع — تابع جبران (موجود ولی فراخوانی نشده):

```3064:3096:src/order/order.service.ts
  private async compensatePaymentIfNeededForGateway(options: {
    paymentType: PaymentType;
    skipThirdparty: boolean;
    paymentVerified: boolean;
    paymentSettled: boolean;
    paymentAlreadyRevertedOrCancelled: boolean;
    paymentExtraInfo: string;
  }): Promise<boolean> {
    // ...
      case PaymentType.SNAPP_PAY:
        if (!options.skipThirdparty) {
          if (options.paymentSettled) {
            await this.snapp.cancel(options.paymentExtraInfo);
          } else if (options.paymentVerified) {
            await this.snapp.revert(options.paymentExtraInfo);
```

📎 مرجع — فراخوانی جبران کامنت شده:

```2595:2619:src/order/order.service.ts
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
```

```2886:2912:src/order/order.service.ts
      } catch (error) {
        // switch (paymentType) {
        //   case PaymentType.SNAPP_PAY:
        //   case PaymentType.TOROB_PAY: {
        //     const handled = await this.compensatePaymentIfNeededForGateway({
        // ...
        throw error;
      }
```

📎 مرجع — بررسی موقت موجودی قبل از تأیید درگاه:

```2067:2075:src/order/order.service.ts
      // temporary handle reserve
      if (
        order.items.some((item) =>
          item.isMarketplace
            ? item.config.sellerAvailableStock < item.quantity
            : item.config.warehouseAvailableStock < item.quantity,
        )
      ) {
        failedPaymentFlag = true;
```

---

### ۴. تداخل همزمانی در تأیید پرداخت

جستجوی تراکنش بدون قفل ردیف یا ثبت اتمیک انجام می‌شود. محافظ تکرار فقط برای تراکنش‌های قبلاً موفق کار می‌کند.

📎 مرجع — جستجوی ساده بدون قفل:

```1870:1882:src/order/order.service.ts
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
```

📎 مرجع — به‌روزرسانی وضعیت به «موفق» (بدون شرط اتمیک «فقط اگر در انتظار بود»):

```2689:2694:src/order/order.service.ts
          await queryRunner.manager.update(
            PaymentTransactionEntity,
            { id: paymentTransaction.id },
            { state: PaymentTransactionState.SUCCESS, trackingNumber },
          );
```

---

### ۵. فاصله زمانی بین ثبت سفارش و تأیید پرداخت

در ثبت سفارش موجودی فقط بررسی می‌شود؛ کم‌کردن در تأیید پرداخت است.

📎 مرجع — بررسی موجودی در ثبت سفارش:

```791:793:src/order/cart.service.ts
      const hasSufficientStock = item.isMarketplace
        ? item.config.sellerAvailableStock >= item.quantity
        : item.config.warehouseAvailableStock >= item.quantity;
```

📎 مرجع — فراخوانی در ثبت سفارش:

```5014:5021:src/order/order.service.ts
        validItems = await this.cartService.validateCartItems(
          cart.id,
          userId,
          address.city,
          cityId,
          provinceId,
          dto.paymentType,
        );
```

📎 مرجع — کم‌کردن واقعی فقط در تأیید (بخش ۱ بالا، خط ۲۸۶۹)

---

### ۶. تابع تأیید پرداخت بیش از حد بزرگ و یکپارچه است

حدود ۱۱۰۰ خط (۱۸۹۹ تا ۳۰۲۶)، ۱۲ درگاه، رفتارهای ناهمگون. برای زرین‌پال در ساخت پرداخت پشتیبانی هست، ولی در بخش تأیید شاخه‌ای نیست.

📎 مرجع — شروع و پایان تابع (اندازه):

```1899:1905:src/order/order.service.ts
  async verifyOrder(
    req: Request,
    res: Response,
    paymentType: PaymentType,
    userId?: number,
    existingQueryRunner?: QueryRunner,
  ) {
```

```3021:3026:src/order/order.service.ts
    } finally {
      if (shouldManageTransaction) {
        await queryRunner.release();
      }
    }
  }
```

📎 مرجع — مثال رفتار متفاوت: زرین‌پلاس مبلغ را دوباره چک می‌کند:

```2427:2439:src/order/order.service.ts
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
```

📎 مرجع — زرین‌پال در ساخت پرداخت:

```3966:3975:src/order/order.service.ts
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
```

📎 مرجع — ولی در تأیید، زرین‌پال شاخه ندارد و به پیش‌فرض می‌خورد:

```2533:2534:src/order/order.service.ts
          default:
            throw new BadRequestException('Unsupported payment type');
```

---

### ۷. ثبت نهایی سفارش هم سنگین و پرحالت است

یک تراکنش بلند از سبد تا ساخت پرداخت. تأیید خودکار در محیط آزمایش با درخواست ساختگی.

📎 مرجع — نقطه ورود + شروع تراکنش:

```4947:4958:src/order/order.service.ts
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
```

📎 مرجع — کنترلر (نیاز به احراز هویت):

```248:262:src/order/order.controller.ts
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
```

📎 مرجع — تأیید خودکار در staging با مکث ۳ ثانیه:

```5309:5338:src/order/order.service.ts
      if (
        (process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV === 'staging') &&
        dto.paymentType !== PaymentType.ITOL &&
        // ...
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
            // ...
          } as unknown as Request,
          {} as Response,
          PaymentType.SAMAN,
          userId,
        );
      }
```

📎 مرجع — برگشت تراکنش در خطای ثبت سفارش:

```5360:5361:src/order/order.service.ts
    } catch (err) {
      await queryRunner.rollbackTransaction();
```

---

### ۸. گلوگاه کارایی در تأیید پرداخت

برای هر کال‌بک، سفارش با روابط تو در تو بارگذاری می‌شود. خود تیم هم TODO گذاشته.

📎 مرجع:

```2029:2060:src/order/order.service.ts
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
        // ...
      });
```

---

## اگر مالک این کد بودم، اولین تغییر چه بود؟

**اولین کار: سفت کردن مرز تأیید پرداخت — نه بازآرایی ظاهری.**

### ۱. حذف یا داخلی‌کردن پرچم دور زدن درگاه

📎 وضعیت فعلی (باید بسته شود):

```1929:1931:src/order/order.service.ts
        case PaymentType.SAMAN:
          transactionId = String(req.body.ResNum);
          skipThirdparty = Boolean(req.body.skipThirdparty);
```

📎 استفاده داخلی مجاز فقط در مسیر مبلغ صفر:

```5229:5229:src/order/order.service.ts
            skipThirdparty: true,
```

### ۲. ثبت اتمیک قبل از هر کار سنگین

📎 وضعیت فعلی (بدون شرط «فقط اگر در انتظار بود»):

```2689:2694:src/order/order.service.ts
          await queryRunner.manager.update(
            PaymentTransactionEntity,
            { id: paymentTransaction.id },
            { state: PaymentTransactionState.SUCCESS, trackingNumber },
          );
```

### ۳. جدا کردن دو فاز + بازگرداندن جبران

📎 تابع جبران آماده است:

```3064:3071:src/order/order.service.ts
  private async compensatePaymentIfNeededForGateway(options: {
    paymentType: PaymentType;
    skipThirdparty: boolean;
    paymentVerified: boolean;
    paymentSettled: boolean;
    paymentAlreadyRevertedOrCancelled: boolean;
    paymentExtraInfo: string;
  }): Promise<boolean> {
```

📎 فراخوانی‌های کامنت‌شده باید برگردند:

```2886:2912:src/order/order.service.ts
      } catch (error) {
        // switch (paymentType) {
        //   case PaymentType.SNAPP_PAY:
        //   case PaymentType.TOROB_PAY: {
        //     const handled = await this.compensatePaymentIfNeededForGateway({
```

### ۴. رفع وضعیت نیمه‌کاره زرین‌پال

📎 ساخت پرداخت فعال:

```3966:3975:src/order/order.service.ts
      case PaymentType.ZARINPAL: {
        const [authority, pgu] = await this.payment.addPayment(
```

📎 تأیید پشتیبانی‌نشده:

```2533:2534:src/order/order.service.ts
          default:
            throw new BadRequestException('Unsupported payment type');
```

---

## جمع‌بندی

تیم روی لاگ، قیف خرید و چند تصمیم دامنه‌ای (موجودی بعد از پرداخت، مبلغ صفر، پوشش تکرار) خوب کار کرده.

اما هسته ثبت سفارش و تأیید پرداخت هنوز یک خط لوله شکننده است. اولین اولویت: قفل کردن مسیر تأیید پول.

📎 مراجع کلیدی:
- ثبت سفارش: `4947:5400:src/order/order.service.ts`
- تأیید پرداخت: `1899:3026:src/order/order.service.ts`
- endpointهای درگاه: `126:186:src/order/order.controller.ts`
