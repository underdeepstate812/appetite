import { IsString, Length, Matches } from "class-validator";
import { RU_PHONE_REGEX } from "@apetite/shared";

export class VerifyOtpDto {
  @IsString()
  @Matches(RU_PHONE_REGEX, { message: "Телефон должен быть в формате +7XXXXXXXXXX" })
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
