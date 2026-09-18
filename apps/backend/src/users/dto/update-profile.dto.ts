import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

/** Телефон сюда намеренно не входит — обязателен для входа/заказов, не редактируется. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
