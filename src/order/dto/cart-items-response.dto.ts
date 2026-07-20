import { ApiProperty } from '@nestjs/swagger';

import { CarPartEntity } from 'src/car-part/entities/car-part.entity';
import { SupplierEntity } from 'src/supplier/entities/supplier.entity';
import { CarPartSize } from 'types/interfaces';
import {
  CarPartSellState,
  DeliveryMethod,
  SBSPrepTimeEnum,
  SellerCollectPeriod,
} from 'types/interfaces/car-part/car-part-config.interface';
import { PaymentType } from 'types/interfaces/payment/payment.interface';

/**
 * Typed response for `CartService.getCartItems`.
 *
 * Goods (`cartItems`) and installation (`installationBookings`) are the two
 * independent axes of a cart. Only client-safe fields are exposed — the
 * installation projection in particular never leaks the technician's sensitive
 * columns or the AMPC's internal columns (see CartService.projectInstallationBookings).
 */

// ─── Goods axis ────────────────────────────────────────────────
export class CartItemConfigDto {
  @ApiProperty() id: number;
  @ApiProperty() minOrderQuantity: number;
  @ApiProperty() maxOrderQuantity: number;
  @ApiProperty() sellerAvailableStock: number;
  @ApiProperty() warehouseAvailableStock: number;
  @ApiProperty() basePrice: number;
  @ApiProperty() price: number;
  @ApiProperty({ enum: CarPartSellState }) sellState: CarPartSellState;
  @ApiProperty({ enum: SellerCollectPeriod })
  collectPeriod: SellerCollectPeriod;
  @ApiProperty({ enum: SBSPrepTimeEnum }) prepTime: SBSPrepTimeEnum;
  @ApiProperty({ enum: DeliveryMethod }) deliveryMethod: DeliveryMethod;
  @ApiProperty({ enum: CarPartSize, required: false })
  size?: CarPartSize;
  @ApiProperty() isScrap: boolean;
  @ApiProperty({ enum: PaymentType, isArray: true })
  supportedPaymentGateways: PaymentType[];
}

export class CartGoodsItemDto {
  @ApiProperty() quantity: number;
  @ApiProperty() isMarketplace: boolean;
  @ApiProperty({ type: () => CartItemConfigDto }) config: CartItemConfigDto;
  // Documented as an opaque object on purpose: the runtime value is the full
  // CarPart / Supplier entity, but pointing Swagger at those entities makes it
  // recurse through their bidirectional relations and throw a circular-dependency
  // error at schema-build time. `type: Object` keeps the response untyped in the
  // docs without crashing. (TS type is still the entity, so the service is checked.)
  @ApiProperty({ type: Object, description: 'Full CarPart entity' })
  product: CarPartEntity;
  @ApiProperty({ type: Object, description: 'Full Supplier entity' })
  supplier: SupplierEntity;
}

// ─── Installation axis ─────────────────────────────────────────
export class CartInstallationTechnicianDto {
  @ApiProperty() userId: number;
  @ApiProperty() shopName: string;
  @ApiProperty() addressDescription: string;
  @ApiProperty() cityId: number;
  @ApiProperty({ nullable: true, type: String })
  cityName: string | null;
  @ApiProperty({ nullable: true, type: Number })
  latitude: number | null;
  @ApiProperty({ nullable: true, type: Number })
  longitude: number | null;
}

export class CartInstallationItemProductDto {
  @ApiProperty({ nullable: true, type: Number }) id: number | null;
  @ApiProperty({ nullable: true, type: String }) name: string | null;
  @ApiProperty({ nullable: true, type: String }) url: string | null;
  @ApiProperty({ nullable: true, type: String }) image: string | null;
}

export class CartInstallationItemDto {
  // null for a guest cart (ephemeral, not persisted); a real id for a
  // logged-in cart's InstallationBookingItem.
  @ApiProperty({ nullable: true, type: Number }) id: number | null;
  @ApiProperty() amptId: number;
  @ApiProperty() carPartConfigId: number;
  @ApiProperty() quantity: number;
  @ApiProperty({
    description:
      "The technician's on-hand AMPT install inventory for this part (units). " +
      'The FE can cap the quantity selector at this value (combined with the ' +
      'AMPC stock).',
  })
  inventory: number;
  @ApiProperty({
    description:
      'AMPC seller-channel available stock (units). The FE picks seller vs ' +
      'warehouse by `isMarketplace`, exactly like goods cart items. Combine ' +
      'with `inventory` (AMPT) to cap the quantity: min(inventory, ampcStock).',
  })
  sellerAvailableStock: number;
  @ApiProperty({
    description: 'AMPC warehouse-channel available stock (units).',
  })
  warehouseAvailableStock: number;
  @ApiProperty({ description: 'AMPT install labor fee, per unit (toman)' })
  serviceFee: number;
  @ApiProperty({
    description:
      'AMPC final part price, per unit (toman) — A/B + per-domain adjusted. ' +
      'This is what the customer pays for the part (was `partPrice`).',
  })
  price: number;
  @ApiProperty({
    description:
      'AMPC base (pre-discount) part price, per unit (toman) — same A/B + ' +
      'per-domain adjustment as `price`. FE shows the discount as price vs basePrice.',
  })
  basePrice: number;
  @ApiProperty() isMarketplace: boolean;
  @ApiProperty({
    enum: PaymentType,
    isArray: true,
    description:
      'Payment gateways the supplying AMPC supports — the FE intersects these ' +
      'with the goods items to compute cartAvailablePaymentGateways.',
  })
  supportedPaymentGateways: PaymentType[];
  @ApiProperty({ type: () => CartInstallationItemProductDto })
  product: CartInstallationItemProductDto;
}

export class CartInstallationBookingDto {
  // null for a guest cart (ephemeral, not persisted); a real id for a
  // logged-in cart's InstallationBooking.
  @ApiProperty({ nullable: true, type: Number }) id: number | null;
  @ApiProperty() technicianUserId: number;
  @ApiProperty() startAt: Date;
  @ApiProperty() endAt: Date;
  @ApiProperty({ type: () => CartInstallationTechnicianDto, nullable: true })
  technician: CartInstallationTechnicianDto | null;
  @ApiProperty({ type: () => CartInstallationItemDto, isArray: true })
  items: CartInstallationItemDto[];
}

// ─── Root ──────────────────────────────────────────────────────
export class CartItemsResponseDto {
  // sourced from process.env — kept as the raw string to preserve the existing
  // response contract (FE parses it as needed).
  @ApiProperty({ type: String }) minimumAmountForFreeShipping: string;
  @ApiProperty({ type: () => CartGoodsItemDto, isArray: true })
  cartItems: CartGoodsItemDto[];
  @ApiProperty({ type: () => CartInstallationBookingDto, isArray: true })
  installationBookings: CartInstallationBookingDto[];
}

/**
 * Guest cart (POST /carPart/guest-cart) response — the same goods/installation
 * shape as the logged-in cart (extends CartItemsResponseDto, so the two stay in
 * sync by construction) plus the guest-specific "your cart changed" flags.
 */
export class GuestCartResponseDto extends CartItemsResponseDto {
  @ApiProperty({
    description:
      'True when one or more GOODS items were deleted because they cannot ship ' +
      'to the selected city. Goods-only — installation removals are surfaced ' +
      'separately via showInstallationCartChangeWarning. Same meaning as the ' +
      'field of the same name on the change-current-city response.',
  })
  showCartChangeWarningOnCityChange: boolean;

  @ApiProperty({
    description:
      'True when one or more goods items were dropped because they became ' +
      'unavailable (quantity < 1, out of stock, or clamped down to the ' +
      'available stock).',
  })
  showCartChangeWarningOnItemDisabled: boolean;

  @ApiProperty({
    description:
      'True when one or more installation items were dropped because the AMPT, ' +
      'its technician, or the part is unavailable/out of stock for the selected ' +
      'city (item-level drop, distinct from a whole-booking removal).',
  })
  showCartChangeWarningOnInstallationDisabled: boolean;

  @ApiProperty({
    description:
      'True when a battery was removed from the cart because it cannot ship to ' +
      'the selected city.',
  })
  batteryRemoved: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'The amper (آمپر) of the removed battery, or null when no battery was removed.',
  })
  removedBatteryAmper: string | null;

  @ApiProperty({
    description:
      'Number of installation bookings removed because no installer exists in the new city',
  })
  installationBookingsRemoved: number;

  @ApiProperty({
    description:
      'True when at least one installation booking was removed, so the FE can show a dedicated installation warning',
  })
  showInstallationCartChangeWarning: boolean;
}
