import { IsOfferImageUrl } from "./is-offer-image-url";
import { ArrayUnique, IsArray, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsPositive, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { DiscountMode, OfferCategory, OfferStatus } from "@prisma/client";
import { DISCOUNT_RULES, INGREDIENTS_MAX_LENGTH, OFFER_ALLERGENS } from "@apetite/shared";

/**
 * discountPercent/discountedPrice не редактируются напрямую — они пересчитываются
 * сервисом сразу при смене originalPriceRub/baseDiscountPercent и докручиваются
 * шедулером каждые 15 минут по времени до конца самовывоза (ШАГ 5). quantityLeft
 * напрямую не задаётся: его двигают заказы и правка quantityTotal (разница прибавляется к остатку,
 * продано не может стать меньше нуля — см. OffersService.update).
 */
export class UpdateOfferDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(OfferCategory)
  category?: OfferCategory;

  @IsOptional()
  @IsPositive()
  originalPriceRub?: number;

  @IsOptional()
  @IsPositive()
  weightKg?: number;

  /** Сколько единиц выложено всего (уже проданные входят). Меньше проданного — нельзя. */
  @IsOptional()
  @IsInt()
  @Min(1)
  quantityTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(DISCOUNT_RULES.MIN_BASE_PERCENT)
  @Max(DISCOUNT_RULES.MAX_PERCENT)
  baseDiscountPercent?: number;

  @IsOptional()
  @IsEnum(DiscountMode)
  discountMode?: DiscountMode;

  @IsOptional()
  @IsDateString()
  pickupStart?: string;

  @IsOptional()
  @IsDateString()
  pickupEnd?: string;

  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  @IsOptional()
  @IsOfferImageUrl()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(INGREDIENTS_MAX_LENGTH)
  ingredients?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(OFFER_ALLERGENS, { each: true })
  allergens?: string[];

  @IsOptional()
  @IsDateString()
  bestBefore?: string;
}
