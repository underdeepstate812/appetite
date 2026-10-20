import { IsInt, Max, Min } from "class-validator";

export class UpdatePlatformSettingsDto {
  /// Бесплатный период при онбординге (ШАГ 0/оферта) — платформа регулирует сама, 20–30
  /// дней по брифу, но жёстко к этому диапазону не привязываем: 0–365 достаточно широко.
  @IsInt()
  @Min(0)
  @Max(365)
  trialPeriodDays!: number;
}
