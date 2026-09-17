import { IsString, Length, Matches } from "class-validator";

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: "Некорректный номер телефона" })
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
