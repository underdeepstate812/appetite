import { IsOfferImageUrl } from "./is-offer-image-url";
import { ArrayUnique, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";
import { DiscountMode, OfferCategory } from "@prisma/client";
import { DISCOUNT_RULES, INGREDIENTS_MAX_LENGTH, OFFER_ALLERGENS } from "@apetite/shared";

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

  /** Растёт ли скидка к концу самовывоза (DYNAMIC, по умолчанию) или остаётся равной baseDiscountPercent (FIXED). */
  @IsOptional()
  @IsEnum(DiscountMode)
  discountMode?: DiscountMode;

  @IsDateString()
  pickupStart!: string;

  @IsDateString()
  pickupEnd!: string;

  @IsOptional()
  @IsOfferImageUrl()
  imageUrl?: string | null;

  /** Состав — обязателен для еды, выпечки и продуктов (проверка в сервисе: зависит от категории). */
  @IsOptional()
  @IsString()
  @MaxLength(INGREDIENTS_MAX_LENGTH)
  ingredients?: string;

  /** Коды аллергенов; пустой массив = «аллергенов нет». Не передан — сведений нет. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(OFFER_ALLERGENS, { each: true })
  allergens?: string[];

  /** Срок годности (ISO). */
  @IsOptional()
  @IsDateString()
  bestBefore?: string;
}
