import { IsDateString, IsEnum, IsInt, IsOptional, IsPositive, IsString, Max, Min, MinLength } from "class-validator";
import { OfferCategory, OfferStatus } from "@prisma/client";
import { DISCOUNT_RULES } from "@apetite/shared";

/**
 * discountPercent/discountedPrice не редактируются напрямую — они пересчитываются
 * сервисом сразу при смене originalPriceRub/baseDiscountPercent и докручиваются
 * шедулером каждые 15 минут по времени до конца самовывоза (ШАГ 5). quantityLeft
 * меняется только через заказы, не через этот эндпоинт.
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

  @IsOptional()
  @IsInt()
  @Min(DISCOUNT_RULES.MIN_BASE_PERCENT)
  @Max(DISCOUNT_RULES.MAX_PERCENT)
  baseDiscountPercent?: number;

  @IsOptional()
  @IsDateString()
  pickupStart?: string;

  @IsOptional()
  @IsDateString()
  pickupEnd?: string;

  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}
