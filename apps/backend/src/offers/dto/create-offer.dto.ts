import { IsDateString, IsEnum, IsInt, IsOptional, IsPositive, IsString, IsUUID, Max, Min, MinLength } from "class-validator";
import { OfferCategory } from "@prisma/client";
import { DISCOUNT_RULES } from "@apetite/shared";

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

  /** Стартовая скидка владельца — шедулер только докручивает её вверх по времени, не ниже. */
  @IsInt()
  @Min(DISCOUNT_RULES.MIN_BASE_PERCENT)
  @Max(DISCOUNT_RULES.MAX_PERCENT)
  baseDiscountPercent!: number;

  @IsDateString()
  pickupStart!: string;

  @IsDateString()
  pickupEnd!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
