import { IsOptional } from "class-validator";

/** PUT /businesses/:id/working-hours. Тело — {"workingHours": {...} | null}; содержимое проверяет shared.validateWorkingHours (в сервисе). */
export class UpdateWorkingHoursDto {
  /** null — снять ограничение по часам работы (вернуться к общим правилам окна). */
  @IsOptional()
  workingHours?: unknown;
}
