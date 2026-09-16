import { Type } from "class-transformer";
import { IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsPositive, Max, Min } from "class-validator";
import { OfferCategory } from "@prisma/client";

export class NearbyOffersQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @Type(() => Number)
  @IsPositive()
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
