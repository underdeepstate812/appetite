import { IsString, Matches } from "class-validator";
import { RU_PHONE_REGEX } from "@apetite/shared";

export class RequestOtpDto {
  @IsString()
  @Matches(RU_PHONE_REGEX, { message: "Телефон должен быть в формате +7XXXXXXXXXX" })
  phone!: string;
}
