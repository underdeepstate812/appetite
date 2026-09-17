import { IsString, Matches } from "class-validator";

export class RequestOtpDto {
  // Простая E.164-подобная проверка — достаточно для беты, не полноценный phone-парсер.
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: "Некорректный номер телефона" })
  phone!: string;
}
