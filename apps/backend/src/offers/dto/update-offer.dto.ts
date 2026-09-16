import { IsDateString, IsEnum, IsOptional, IsPositive, IsString, MinLength } from "class-validator";
import { OfferCategory, OfferStatus } from "@prisma/client";

/**
 * discountPercent/discountedPrice не редактируются напрямую — ими управляет
 * шедулер скидок (ШАГ 5); при смене originalPriceRub сервис пересчитывает
 * discountedPrice, сохраняя текущий discountPercent. quantityLeft меняется
 * только через заказы (ШАГ 5), не через этот эндпоинт.
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
  @IsDateString()
  pickupStart?: string;

  @IsOptional()
  @IsDateString()
  pickupEnd?: string;

  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}
