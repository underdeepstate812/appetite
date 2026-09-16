import { IsString, Length } from "class-validator";
import { PICKUP_CODE_LENGTH } from "@apetite/shared";

export class CompleteOrderDto {
  @IsString()
  @Length(PICKUP_CODE_LENGTH, PICKUP_CODE_LENGTH)
  pickupCode!: string;
}
