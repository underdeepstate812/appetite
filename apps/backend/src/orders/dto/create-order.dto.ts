import { IsInt, IsUUID, Min } from "class-validator";

export class CreateOrderDto {
  @IsUUID()
  offerId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
