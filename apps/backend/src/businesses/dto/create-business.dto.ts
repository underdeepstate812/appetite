import { IsEmail, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { OfferCategory } from "@prisma/client";
import { PASSWORD_MIN_LENGTH, STRONG_PASSWORD_REGEX } from "@apetite/shared";

/**
 * Ручной онбординг заведения админом (ШАГ 0): один запрос создаёт и владельца
 * (роль BUSINESS), и само заведение сразу в статусе ACTIVE.
 */
export class CreateBusinessDto {
  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(STRONG_PASSWORD_REGEX, {
    message: "Пароль должен содержать заглавную и строчную буквы, цифру и спецсимвол",
  })
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

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
