import { IsDateString, IsEnum, IsInt, IsOptional, IsPositive, IsString, IsUUID, Min, MinLength } from "class-validator";
import { OfferCategory } from "@prisma/client";

export class CreateOfferDto {
  @IsUUID()
  businessId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(OfferCategory)
  category!: OfferCategory;

  /** В рублях (не в копейках) — сервис сам переводит в минорные единицы для хранения. */
  @IsPositive()
  originalPriceRub!: number;

  @IsPositive()
  weightKg!: number;

  @IsInt()
  @Min(1)
  quantityTotal!: number;

  @IsDateString()
  pickupStart!: string;

  @IsDateString()
  pickupEnd!: string;
}
