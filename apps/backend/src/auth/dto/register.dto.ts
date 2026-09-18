import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { PASSWORD_MIN_LENGTH, RU_PHONE_REGEX, STRONG_PASSWORD_REGEX } from "@apetite/shared";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(STRONG_PASSWORD_REGEX, {
    message: "Пароль должен содержать заглавную и строчную буквы, цифру и спецсимвол",
  })
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  /** Если указан, должен быть предварительно подтверждён через /auth/otp/verify. */
  @IsOptional()
  @Matches(RU_PHONE_REGEX, { message: "Телефон должен быть в формате +7XXXXXXXXXX" })
  phone?: string;
}
