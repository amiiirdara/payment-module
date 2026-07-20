import { BadRequestException } from '@nestjs/common';
import { differenceInCalendarDays, format } from 'date-fns-jalali';
import { ShippingDurationEnum } from 'types/interfaces/order/order.interface';
import { faIR } from 'date-fns-jalali/locale';

export class OrderUtils {
  static isFriday(date: Date): boolean {
    return date.getDay() === 5;
  }

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
      if (breakdown) {
        const details: string[] = [];
        if (breakdown.cartTotal !== undefined)
          details.push(`جمع سبد خرید و کارمزد: ${breakdown.cartTotal}`);
        if (breakdown.shippingCost !== undefined)
          details.push(`هزینه ارسال: ${breakdown.shippingCost}`);
        if (breakdown.packingCost !== undefined)
          details.push(`هزینه بسته‌بندی: ${breakdown.packingCost}`);
        if (breakdown.discountAmount)
          details.push(`تخفیف: ${breakdown.discountAmount}`);
        if (details.length > 0) lines.push(details.join('، '));
      }
      throw new BadRequestException(lines.join('\n'));
    }
  }

  static getShippingDurationLentgh(
    shippingDuration: ShippingDurationEnum,
  ): number {
    switch (shippingDuration) {
      case ShippingDurationEnum.UNDER0HOURS:
        return 0;
      case ShippingDurationEnum.UNDER1HOURS:
        return 1;
      case ShippingDurationEnum.UNDER2HOURS:
        return 2;
      case ShippingDurationEnum.UNDER3HOURS:
        return 3;
      case ShippingDurationEnum.UNDER24HOURS:
        return 24;
      case ShippingDurationEnum.UNDER48HOURS:
        return 48;
      case ShippingDurationEnum.WORKING_DAYS_2_OR_3:
        return 72; // Assuming 2-3 working days is approximately 72 hours
      case ShippingDurationEnum.WORKING_DAYS_2_OR_4:
        return 96; // Assuming 2-4 working days is approximately 96 hours
      case ShippingDurationEnum.WORKING_DAYS_3_OR_5:
        return 120; // Assuming 3-5 working days is approximately 120 hours
      case ShippingDurationEnum.WORKING_DAYS_4_OR_6:
        return 144; // Assuming 4-6 working days is approximately 144 hours
      case ShippingDurationEnum.WORKING_DAYS_5_OR_7:
        return 168; // Assuming 5-7 working days is approximately 168 hours
      case ShippingDurationEnum.WORKING_DAYS_6_OR_8:
        return 192; // Assuming 6-8 working days is approximately 192 hours
      default:
        throw new BadRequestException('Invalid shipping duration');
    }
  }

  static isDeliveryRange(shippingDuration: ShippingDurationEnum): boolean {
    return shippingDuration.toString().startsWith('WORKING_DAYS');
  }

  static getDeliveryRange(shippingDuration: ShippingDurationEnum) {
    switch (shippingDuration) {
      case ShippingDurationEnum.WORKING_DAYS_2_OR_4:
      case ShippingDurationEnum.WORKING_DAYS_3_OR_5:
      case ShippingDurationEnum.WORKING_DAYS_4_OR_6:
      case ShippingDurationEnum.WORKING_DAYS_5_OR_7:
      case ShippingDurationEnum.WORKING_DAYS_6_OR_8:
        return 2;
      case ShippingDurationEnum.WORKING_DAYS_2_OR_3:
        return 1;
      default:
        return 0;
    }
  }

  static cleanObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj
        .map(OrderUtils.cleanObject)
        .filter(
          (item) =>
            !(
              typeof item === 'object' &&
              item !== null &&
              Object.keys(item).length === 0
            ),
        );
    } else if (obj && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        const cleanedValue = OrderUtils.cleanObject(value);
        if (
          value !== null &&
          value !== undefined &&
          !(
            typeof cleanedValue === 'object' &&
            cleanedValue !== null &&
            Object.keys(cleanedValue).length === 0
          )
        ) {
          acc[key] = cleanedValue;
        }
        return acc;
      }, {} as any);
    }
    return obj;
  }

  static formatDeliveryDateFa(
    date: Date,
    from?: Date,
    showWeekDay = true,
  ): string {
    if (!from) {
      from = new Date();
    }

    const diffDays = differenceInCalendarDays(date, from);
    if (diffDays === 0) {
      return 'امروز';
    } else if (diffDays === 1) {
      return 'فردا';
    } else {
      return (
        (showWeekDay ? format(date, 'EEEE', { locale: faIR }) + ' ' : '') +
        format(date, 'd MMMM', { locale: faIR })
      );
    }
  }
}
