import { IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { BusinessStatus, OfferCategory } from "@prisma/client";

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(OfferCategory)
  category?: OfferCategory;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  /** Меняется только модератором — сервис игнорирует поле, если запрос не от ADMIN. */
  @IsOptional()
  @IsEnum(BusinessStatus)
  status?: BusinessStatus;

  /** Настраиваемая по заведениям комиссия (ШАГ 0/11) — тоже только ADMIN. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  commissionPercent?: number;
}
