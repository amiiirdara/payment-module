import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { ParcelService } from '../services/parcel.service';
import { ParcelDeliveryMethod } from 'types/interfaces/order/order.interface';

@Injectable({ scope: Scope.REQUEST })
export class ParcelLoader {
  constructor(private readonly parcelService: ParcelService) {}

  public readonly getSupplierDeliveryDate = new DataLoader<number, Date | null>(
    async (parcelIds) => {
      try {
        const parcelData = await this.parcelService.getParcelDeadlineData(
          parcelIds,
        );

        return parcelIds.map((id) => {
          const parcel = parcelData.find((parcel) => parcel.id === id);
          return parcel
            ? parcel.parcelDeliveryMethod === ParcelDeliveryMethod.SELLER
              ? parcel.prepDeadline
              : parcel.collectDeadline
            : null;
        });
      } catch (error) {
        throw error;
      }
    },
  );
}
