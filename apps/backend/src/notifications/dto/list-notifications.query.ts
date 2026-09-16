import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Min } from "class-validator";

export class ListNotificationsQueryDto {
  @IsOptional()
  // Type(() => Boolean) вызывает JS-конструктор Boolean("false") === true — любая непустая
  // строка из query-параметра "истинна". Явный маппинг вместо этого.
  @Transform(({ value }) => (value === undefined ? value : value === true || value === "true"))
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
