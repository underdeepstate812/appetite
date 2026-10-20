import { Type } from "class-transformer";
import { IsIn, IsOptional } from "class-validator";
import { SALES_PERIODS } from "@apetite/shared";

export class SalesQueryDto {
  /** Длина периода графика, дней; по умолчанию 14. */
  @IsOptional()
  @Type(() => Number)
  @IsIn([...SALES_PERIODS])
  days?: number;
}
