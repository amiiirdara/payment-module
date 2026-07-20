import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export interface ShoppingCartBrief {
  configId: number;
  quantity: number;
}

export class BulkCreateShoppingCartDto {
  @IsDefined()
  @ValidateNested({ always: true })
  @Type(() => CreateShoppingCartDto)
  @IsArray()
  cart: CreateShoppingCartDto[];
}
export class CreateShoppingCartDto {
  @ApiProperty()
  @IsDefined()
  @IsPositive()
  configId: number;

  @ApiProperty()
  @IsDefined()
  @IsNumber()
  quantity: number;
}

export class AddToCartDto {
  @ApiProperty({
    type: CreateShoppingCartDto,
    isArray: true,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateShoppingCartDto)
  @IsArray()
  items: CreateShoppingCartDto[];

  @ApiProperty({ type: Number })
  @IsOptional()
  @IsNumber()
  inStoreSupplierUserId?: number;
}

/**
 * Local-cart installation-booking item shape. Mirrors the cart-side
 * `AddInstallationItemDto` (without the technicianUserId, derived from AMPT).
 */
export class LocalInstallationBookingItemDto {
  @ApiProperty()
  @IsDefined()
  @IsInt()
  @Min(1)
  amptId: number;

  @ApiProperty()
  @IsDefined()
  @IsInt()
  @Min(1)
  carPartConfigId: number;

  @ApiProperty()
  @IsDefined()
  @IsInt()
  @Min(1)
  quantity: number;
}

/**
 * Local-cart installation booking — one booking per (technician, day).
 * `technicianUserId` is kept explicit so the FE doesn't need to look up the
 * technician from one of the items (and so we can fast-reject mismatched
 * AMPTs without round-tripping). Server still validates AMPT.technicianUserId
 * matches.
 */
export class LocalInstallationBookingDto {
  @ApiProperty()
  @IsDefined()
  @IsInt()
  @Min(1)
  technicianUserId: number;

  @ApiProperty({
    description:
      'ISO 8601 start of the chosen 2-hour slot (Asia/Tehran wall-clock semantics)',
  })
  @IsDefined()
  @Type(() => Date)
  @IsDate()
  startAt: Date;

  @ApiProperty({
    type: LocalInstallationBookingItemDto,
    isArray: true,
  })
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocalInstallationBookingItemDto)
  items: LocalInstallationBookingItemDto[];
}

export class MergeShoppingCartDto {
  @ApiProperty({
    type: CreateShoppingCartDto,
    isArray: true,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateShoppingCartDto)
  @IsArray()
  localCart: CreateShoppingCartDto[];

  /**
   * Local installation bookings stored client-side before login. Each booking
   * is replayed server-side via the same `InstallationBookingService.updateItem`
   * the regular flow uses, so all validation (in-city, AMPT.state, stock cap,
   * AMP-coherence, lead-time) runs unchanged. Items that fail validation are
   * skipped silently and surfaced via the `showCartChangeWarningOnInstallationDisabled`
   * flag in the response (mirrors the `showCartChangeWarningOnItemDisabled`
   * pattern for goods).
   */
  @ApiProperty({
    type: LocalInstallationBookingDto,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocalInstallationBookingDto)
  localInstallationBookings?: LocalInstallationBookingDto[];

  @ApiProperty({ type: Number })
  @IsOptional()
  @IsNumber()
  cityId?: number;
}
