import { IsString, MinLength } from "class-validator";

export class LoginDto {
  /** Email или телефон в формате +7XXXXXXXXXX — сервис сам определяет, что это. */
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  password!: string;
}
