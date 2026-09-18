import { Equals, IsEmail, IsEnum, IsString, Matches, MinLength } from "class-validator";
import { OfferCategory } from "@prisma/client";
import { RU_PHONE_REGEX } from "@apetite/shared";

export class CreateBusinessApplicationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(OfferCategory)
  category!: OfferCategory;

  @IsString()
  @MinLength(5)
  address!: string;

  @IsString()
  @MinLength(2)
  contactName!: string;

  @IsEmail()
  contactEmail!: string;

  @Matches(RU_PHONE_REGEX, { message: "Телефон должен быть в формате +7XXXXXXXXXX" })
  contactPhone!: string;

  /** Заявка без принятой оферты не создаётся — это не просто галочка UI, а условие подачи. */
  @Equals(true, { message: "Нужно принять условия оферты" })
  ofertaAccepted!: boolean;
}
