import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ParcelEntity } from '../entities/parcel.entity';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { ParcelChangeStateService } from './parcel-change-state.service';
import {
  ParcelDeliveryMethod,
  ParcelShippingCourier,
  ParcelStateEnum,
} from 'types/interfaces/order/order.interface';
import { PhysicalItemService } from 'src/physical-item/services/physical-item.service';
import {
  CancelParcelInput,
  CancelPickUpInstoreParcelInput,
} from 'src/physical-item/dto/physical-item.dto';
import { JwtDto } from 'src/auth/dto/jwt.dto';
import { Utils, WrapperType } from 'src/common/utils';
import { ParcelChangeStateInput } from '../dto/order.dto';
import { OrderService } from '../order.service';

@Injectable()
export class ParcelService {
  constructor(
    @InjectRepository(ParcelEntity)
    private readonly parcelRepository: Repository<ParcelEntity>,

    private readonly parcelChangeStateService: ParcelChangeStateService,

    @Inject(forwardRef(() => OrderService))
    private readonly orderService: WrapperType<OrderService>,

    @Inject(forwardRef(() => PhysicalItemService))
    private readonly physicalItemService: WrapperType<PhysicalItemService>,

    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async startProccessing(
    parcelId: number,
    userId: number,
    queryRunner: QueryRunner,
  ) {
    await this.parcelChangeStateService.changeState(
      parcelId,
      ParcelStateEnum.PROCESSING,
      queryRunner,
      {
        userId,
      },
    );
  }

  async startSellerConfirmProccessing(
    parcelId: number,
    userId: number,
    queryRunner: QueryRunner,
  ) {
    await this.parcelChangeStateService.changeState(
      parcelId,
      ParcelStateEnum.WAITING_FOR_SELLER_CONFIRM,
      queryRunner,
      {
        userId,
      },
    );
  }

  async parcelChangeState(
    input: ParcelChangeStateInput,
    user: JwtDto,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.parcelChangeStateService.changeState(
        input.parcelId,
        input.state,
        queryRunner,
        {
          userId: user.id,
        },
      );
      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async moveParcelToCanceled(
    parcelId: number,
    userId: number,
    queryRunner: QueryRunner,
  ) {
    await this.parcelChangeStateService.changeState(
      parcelId,
      ParcelStateEnum.CANCELLED_ADMIN,
      queryRunner,
      {
        userId,
      },
    );
  }

  async markPickupInStoreDelivered(
    parcelId: number,
    userId: number,
    queryRunner: QueryRunner,
  ) {
    await this.parcelChangeStateService.changeState(
      parcelId,
      ParcelStateEnum.PICKUP_IN_STORE_DELIVERED,
      queryRunner,
      {
        userId,
      },
    );
  }

  async adminParcelCancel(
    input: CancelParcelInput,
    user: JwtDto,
    callThirdParty: boolean,
    options?: { queryRunner?: QueryRunner },
  ): Promise<boolean> {
    const shouldManageTransaction = !options?.queryRunner;
    let queryRunner: QueryRunner;
    if (shouldManageTransaction) {
      queryRunner =
        this.parcelRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
    } else {
      queryRunner = options?.queryRunner;
    }

    try {
      const parcel = await this.parcelRepository.findOne({
        where: { id: input.parcelId },
        select: {
          id: true,
          state: true,
        },
      });
      if (!parcel) {
        throw new BadRequestException(
          Utils.generateErrorForOperation(
            'پارسل مورد نظر پیدا نشد',
            ['ایدی پارسل که پیدا نشد', input.parcelId],
            ['دیتا های اضافی ارسال شده', input],
          ),
        );
      }
      if (parcel.state === ParcelStateEnum.CANCELLED_ADMIN) {
        throw new BadRequestException(
          Utils.generateErrorForOperation(
            'این پارسل قبلا لغو شده است',
            ['ایدی پارسل که پیدا نشد', input.parcelId],
            ['دیتا های اضافی ارسال شده', input],
          ),
        );
      }

      const physicalOrderItemsToCancel =
        await this.physicalItemService.getParcelActivePhysicalOrderItemsByParcelId(
          input.parcelId,
          queryRunner,
        );
      if (physicalOrderItemsToCancel.length <= 0) {
        throw new BadRequestException(
          Utils.generateErrorForOperation(
            'هیچ آیتم فیزیکی برای لغو وجود ندارد',
            ['ایدی پارسل که پیدا نشد', input.parcelId],
            ['دیتا های اضافی ارسال شده', input],
          ),
        );
      }

      await this.physicalItemService.adminCancelPhysicalItems(
        physicalOrderItemsToCancel.map((physicalOrderItem) => ({
          physicalOrderItemId: physicalOrderItem.id,
          reason: input.reason,
          description: input.description,
        })),
        user,
        { callThirdParty, queryRunner },
      );

      if (shouldManageTransaction) {
        await queryRunner.commitTransaction();
      }
      return true;
    } catch (error) {
      if (shouldManageTransaction) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (shouldManageTransaction) {
        await queryRunner.release();
      }
    }
  }

  async pickUpInstoreParcelCancel(
    input: CancelPickUpInstoreParcelInput,
    user: JwtDto,
  ): Promise<boolean> {
    const queryRunner =
      this.parcelRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const parcel = await queryRunner.manager.findOne(ParcelEntity, {
        where: { id: input.parcelId },
        select: {
          id: true,
          state: true,
        },
      });

      if (!parcel) {
        throw new BadRequestException(
          Utils.generateErrorForOperation(
            'پارسل مورد نظر پیدا نشد',
            ['ایدی پارسل که پیدا نشد', input.parcelId],
            ['دیتا های اضافی ارسال شده', input],
          ),
        );
      }

      if (parcel.state === ParcelStateEnum.CANCELLED_ADMIN) {
        throw new BadRequestException(
          Utils.generateErrorForOperation(
            'این پارسل قبلا لغو شده است',
            ['ایدی پارسل که پیدا نشد', input.parcelId],
            ['دیتا های اضافی ارسال شده', input],
          ),
        );
      }

      const physicalOrderItems =
        await this.physicalItemService.getPhyshicalOrderItemsByParcelId(
          parcel.id,
          queryRunner,
        );

      if (physicalOrderItems.length === 0) {
        throw new BadRequestException(
          Utils.generateErrorForOperation(
            'هیچ آیتم فیزیکی برای لغو وجود ندارد',
            ['ایدی پارسل که پیدا نشد', input.parcelId],
            ['دیتا های اضافی ارسال شده', input],
          ),
        );
      }

      const physicalOrderItemsToCancel =
        await this.physicalItemService.getParcelActivePhysicalOrderItemsByParcelId(
          input.parcelId,
          queryRunner,
        );

      if (physicalOrderItemsToCancel.length <= 0) {
        throw new BadRequestException(
          Utils.generateErrorForOperation(
            'هیچ آیتم فیزیکی برای لغو وجود ندارد',
            ['ایدی پارسل که پیدا نشد', input.parcelId],
            ['دیتا های اضافی ارسال شده', input],
          ),
        );
      }
      // cancel just active physical order itms
      await this.physicalItemService.cancelPhysicalOrderItems(
        physicalOrderItemsToCancel.map((item) => item.id),
        queryRunner,
      );

      const physicalItems =
        this.physicalItemService.collectCancelablePhysicalItems(
          physicalOrderItemsToCancel,
        );

      await this.physicalItemService.cancelPhysicalItems(
        physicalItems,
        queryRunner,
      );

      await this.physicalItemService.addCancelReasons(
        physicalOrderItemsToCancel.map((item) => ({
          physicalOrderItemId: item.id,
          reason: input.reason,
          description: input.description,
        })),
        user.id,
        queryRunner,
      );

      await this.moveParcelToCanceled(parcel.id, user.id, queryRunner);
      // this happends because of pickup in store orders allways has one parcel
      const orderId = physicalOrderItems[0].orderItem.orderId;
      await this.orderService.cancelOrderThirdPartyAndSendSms(
        orderId,
        user.id,
        queryRunner,
        true,
      );

      await queryRunner.commitTransaction();
      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async sellerParcelCancel(
    input: CancelParcelInput,
    user: JwtDto,
  ): Promise<boolean> {
    // check parcele is shippBySeller and one item of it has supplieruserid with userId
    const parcel = await this.parcelRepository.findOne({
      where: { id: input.parcelId },
      relations: {
        physicalOrderItems: {
          orderItem: {
            config: true,
          },
        },
      },
      select: {
        id: true,
        parcelDeliveryMethod: true,
        physicalOrderItems: {
          id: true,
          orderItem: {
            id: true,
            config: {
              id: true,
              supplierUserId: true,
            },
          },
        },
      },
    });
    if (!parcel) {
      throw new BadRequestException(
        Utils.generateErrorForOperation(
          'پارسل مورد نظر پیدا نشد',
          ['ایدی پارسل که پیدا نشد', input.parcelId],
          ['دیتا های اضافی ارسال شده', input],
        ),
      );
    }
    if (parcel.parcelDeliveryMethod !== ParcelDeliveryMethod.SELLER) {
      throw new BadRequestException(
        Utils.generateErrorForOperation(
          'این پارسل توسط این فروشنده ارسال نشده است',
          ['ایدی پارسل که پیدا نشد', input.parcelId],
          ['دیتا های اضافی ارسال شده', input],
        ),
      );
    }
    if (
      !parcel.physicalOrderItems.some(
        (item) => item.orderItem.config.supplierUserId === user.id,
      )
    ) {
      throw new BadRequestException(
        Utils.generateErrorForOperation(
          'شما اجازه لغو این پارسل را ندارید',
          ['ایدی پارسل که پیدا نشد', input.parcelId],
          ['دیتا های اضافی ارسال شده', input],
        ),
      );
    }

    return this.adminParcelCancel(input, user, true);
  }

  public async getParcelStateById(parcelId: number): Promise<ParcelStateEnum> {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      select: { id: true, state: true },
    });
    if (!parcel) {
      throw new BadRequestException(
        Utils.generateErrorForOperation('پارسل مورد نظر پیدا نشد', [
          'ایدی پارسل که پیدا نشد',
          parcelId,
        ]),
      );
    }
    return parcel.state;
  }

  public async getParcelCourierById(
    parcelId: number,
  ): Promise<ParcelShippingCourier | null> {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      select: { id: true, courier: true },
    });
    if (!parcel) {
      throw new BadRequestException(
        Utils.generateErrorForOperation('پارسل مورد نظر پیدا نشد', [
          'ایدی پارسل که پیدا نشد',
          parcelId,
        ]),
      );
    }
    return parcel.courier ?? null;
  }

  async getParcelDeadlineData(parcelIds: readonly number[]) {
    return await this.parcelRepository.find({
      where: { id: In(parcelIds) },
      select: {
        id: true,
        prepDeadline: true,
        collectDeadline: true,
        parcelDeliveryMethod: true,
      },
    });
  }
}
