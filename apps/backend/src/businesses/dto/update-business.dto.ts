import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from "class-validator";
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

  /** Меняется только модератором — сервис игнорирует поле, если запрос не от ADMIN. */
  @IsOptional()
  @IsEnum(BusinessStatus)
  status?: BusinessStatus;
}
