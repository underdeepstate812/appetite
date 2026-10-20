import { Type } from "class-transformer";
import { IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsPositive, Max, Min } from "class-validator";
import { OfferCategory } from "@prisma/client";

/** Верхняя граница поиска: без неё radiusKm=99999999 отдаёт весь каталог одним запросом. */
export const MAX_NEARBY_RADIUS_KM = 100;

export class NearbyOffersQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @Type(() => Number)
  @IsPositive()
  @Max(MAX_NEARBY_RADIUS_KM, { message: `radiusKm не может быть больше ${MAX_NEARBY_RADIUS_KM} км` })
  radiusKm!: number;

  @IsOptional()
  @IsEnum(OfferCategory)
  category?: OfferCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(70)
  minDiscount?: number;
}
