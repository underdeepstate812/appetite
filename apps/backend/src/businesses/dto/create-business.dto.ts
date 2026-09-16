import { IsEmail, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from "class-validator";
import { OfferCategory } from "@prisma/client";

/**
 * Ручной онбординг заведения админом (ШАГ 0): один запрос создаёт и владельца
 * (роль BUSINESS), и само заведение сразу в статусе ACTIVE.
 */
export class CreateBusinessDto {
  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  ownerPassword!: string;

  @IsString()
  @MinLength(2)
  ownerName!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(OfferCategory)
  category!: OfferCategory;

  @IsString()
  address!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}
