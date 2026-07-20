import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaymentType } from 'types/interfaces/payment/payment.interface';

export class CreateOrderPickupInStoreDto {
  @ApiProperty()
  @IsDefined()
  @IsNumber()
  inStoreSupplierUserId: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  discountCode: string;

  @ApiProperty({
    enum: PaymentType,
  })
  @IsDefined()
  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @ApiProperty()
  @IsDefined()
  @IsNumber()
  totalPrice: number;
}
