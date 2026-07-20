import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatisticsTimeRanges } from 'types/interfaces/order/order.interface';

@InputType()
export class OrderStatisticsRangeDto {
  @Field(() => OrderStatisticsTimeRanges, { nullable: true })
  @IsEnum(OrderStatisticsTimeRanges)
  @IsOptional()
  range?: OrderStatisticsTimeRanges;
}
