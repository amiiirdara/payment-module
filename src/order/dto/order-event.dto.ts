import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class OrderEventDto {
  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: 'Description should not be empty' })
  description: string;

  @Field(() => Int)
  @IsInt()
  orderId: number;

  @Field(() => Int)
  @IsInt()
  parcelId: number;
}
