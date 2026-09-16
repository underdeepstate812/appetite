import { IsEnum, IsOptional } from "class-validator";
import { OfferCategory } from "@prisma/client";

export class ListBusinessesQueryDto {
  @IsOptional()
  @IsEnum(OfferCategory)
  category?: OfferCategory;
}
