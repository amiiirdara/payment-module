import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderEventEntity } from './entities/order-events.entity';
// removed duplicate import of forwardRef
import { CarPartModule } from 'src/car-part/car-part.module';
import { DiscountModule } from 'src/discount/discount.module';
import { OrderEntity } from './entities/order.entity';
import { ManualRefundEntity } from './entities/manual-refund.entity';
import { ShoppingCartController } from './cart.controller';
import { OrderShippingEntity } from './entities/order-shipping.entity';
import { AddressModule } from 'src/address/address.module';
import { UsersModule } from 'src/users/users.module';
import { OrderResolver } from './resolvers/order.resolver';
import { CartResolver } from './resolvers/cart.resolver';
import { OrderLoader } from './loaders/order.loader';
import { CartEntity } from './entities/cart.entity';
import { CartItemEntity } from './entities/cart-item.entity';
import { PaymentModule } from '../payments/payment.module';
import { SearchModule } from '../search/search.module';
import { OrderItemResolver } from './resolvers/order-item.resolver';
import { EwanoModule } from 'src/ewano/ewano.module';
import { PaymentThirdPartyModule } from 'src/common/payment/payment-thirdparty.module';
import { TakhfifanModule } from 'src/takhfifan/takhfifan.module';
import { OrderItemLoader } from './loaders/order-item.loader';
import { PhysicalItemModule } from 'src/physical-item/physical-item.module';
import { OrderCancelDescriptionEntity } from './entities/order-cancel-description.entity';
import { OrderGovermentTiresEntity } from './entities/order-goverment-tires.entity';
import { ProcessCapacityModule } from 'src/process-capacity/process-capacity.module';
import { PhysicalOrderItemLoader } from 'src/physical-item/loader/physical-order-item.loader';
import { PhysicalOrderItemEntity } from 'src/physical-item/entities/physical-order-item.entity';
import { ParcelEntity } from './entities/parcel.entity';
import { ParcelResolver } from './resolvers/parcel.resolver';
import { ParcelChangeStateService } from './services/parcel-change-state.service';
import { OrderEventResolver } from './resolvers/order-event.resolver';
import { CartService } from './cart.service';
import { ParcelService } from './services/parcel.service';
import { RefundService } from './services/refund.service';
import { ManualRefundService } from './services/manual-refund.service';
import { ManualRefundResolver } from './resolvers/manual-refund.resolver';
import { ItolModule } from 'src/itol/itol.module';
import { ReturnModule } from 'src/return/return.module';
import { DigipayModule } from 'src/digipay/digipay.module';
import { AzkiModule } from 'src/azki/azki.module';
import { RoleModule } from 'src/role/role.module';
import { SupplierModule } from 'src/supplier/supplier.module';
import { ParcelLoader } from './loaders/parcel.loader';
import { AbTestModule } from 'src/ab-test/ab-test.module';
import { PaymentGatewayEntity } from 'src/payment-gateway/entities/payment-gateway.entity';
import { OrderExperimentEntity } from './entities/order-experiment.entity';
import { CampaignModule } from 'src/campaign/campaign.module';
import { ShippingModule } from 'src/shipping/shipping.module';
import { SnappBoxModule } from 'src/snapp-box/snapp-box.module';
import { DomainPaymentGatewayCatJoinEntity } from './entities/dpg-cat-join.entity';
import { PaymentGatewayModule } from 'src/payment-gateway/payment-gateway.module';
import { DomainPaymentGatewayEntity } from 'src/payment-gateway/entities/domain-payment-gateway.entity';
import { ServiceModule } from 'src/service/service.module';
import { ZarinPlusModule } from 'src/zarinplus/zarinplus.module';
import { KeepaModule } from 'src/keepa/keepa.module';
import { VibeModule } from 'src/vibe/vibe.module';
import { SupplierCalendarModule } from 'src/supplier-calendar/supplier-calendar.module';
import { InstallationBookingEntity } from 'src/installation/entities/installation-booking.entity';
import { InstallationBookingItemEntity } from 'src/installation/entities/installation-booking-item.entity';
import { InstallationModule } from 'src/installation/installation.module';

@Module({
  imports: [
    PaymentThirdPartyModule,
    TypeOrmModule.forFeature([
      CartEntity,
      CartItemEntity,
      OrderEntity,
      ManualRefundEntity,
      OrderItemEntity,
      OrderShippingEntity,
      OrderEventEntity,
      OrderCancelDescriptionEntity,
      OrderGovermentTiresEntity,
      PhysicalOrderItemEntity,
      ParcelEntity,
      PaymentGatewayEntity,
      OrderExperimentEntity,
      DomainPaymentGatewayCatJoinEntity,
      DomainPaymentGatewayEntity,
      InstallationBookingEntity,
      InstallationBookingItemEntity,
    ]),
    forwardRef(() => CarPartModule),
    forwardRef(() => DiscountModule),
    forwardRef(() => AddressModule),
    forwardRef(() => UsersModule),
    PaymentModule,
    SearchModule,
    EwanoModule,
    TakhfifanModule,
    PhysicalItemModule,
    ProcessCapacityModule,
    SupplierCalendarModule,
    PhysicalItemModule,
    ItolModule,
    forwardRef(() => ReturnModule),
    forwardRef(() => ShippingModule),
    forwardRef(() => SnappBoxModule),
    DigipayModule,
    AzkiModule,
    ZarinPlusModule,
    KeepaModule,
    VibeModule,
    RoleModule,
    SupplierModule,
    AbTestModule,
    forwardRef(() => CampaignModule),
    forwardRef(() => PaymentGatewayModule),
    forwardRef(() => ServiceModule),
    // Installation feature — needed by CartService.mergeCarts to replay
    // local installation bookings via InstallationBookingService. Cyclic
    // since InstallationModule already forwardRefs OrderModule; the
    // forwardRef on both sides is the standard Nest fix.
    forwardRef(() => InstallationModule),
  ],
  providers: [
    OrderService,
    CartService,
    OrderResolver,
    OrderEventResolver,
    CartResolver,
    OrderItemResolver,
    OrderLoader,
    ParcelLoader,
    OrderItemLoader,
    PhysicalOrderItemLoader,
    ParcelResolver,
    ParcelChangeStateService,
    ParcelService,
    RefundService,
    ManualRefundService,
    ManualRefundResolver,
  ],
  controllers: [OrderController, ShoppingCartController],
  exports: [
    OrderService,
    OrderLoader,
    ParcelLoader,
    OrderItemLoader,
    ParcelChangeStateService,
    ParcelService,
    CartService,
    RefundService,
  ],
})
export class OrderModule {}
