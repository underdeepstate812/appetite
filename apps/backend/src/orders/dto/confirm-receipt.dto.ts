import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";
import { ReceiptDisputeReason } from "@prisma/client";

/** Ответ покупателя после выдачи: received=true — «получил»; received=false — спор, причина обязательна. */
export class ConfirmReceiptDto {
  @IsBoolean()
  received!: boolean;

  @ValidateIf((dto: ConfirmReceiptDto) => dto.received === false)
  @IsEnum(ReceiptDisputeReason)
  reason?: ReceiptDisputeReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
