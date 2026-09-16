import { IsEnum, IsString } from "class-validator";
import { PaymentStatus } from "@prisma/client";

export class PaymentWebhookDto {
  @IsString()
  externalId!: string;

  @IsEnum(PaymentStatus)
  status!: PaymentStatus;
}
