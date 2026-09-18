import { Body, Controller, Post } from "@nestjs/common";
import { BusinessApplicationsService } from "./business-applications.service";
import { CreateBusinessApplicationDto } from "./dto/create-business-application.dto";

/**
 * Публичная форма "Для бизнеса" (веб-лендинг) — без auth: до подачи заявки
 * у владельца ещё нет аккаунта. Заведение НЕ создаётся напрямую (ШАГ 0 —
 * только ручной онбординг админом), заявка лишь фиксируется для ревью.
 */
@Controller("business-applications")
export class BusinessApplicationsController {
  constructor(private readonly service: BusinessApplicationsService) {}

  @Post()
  create(@Body() dto: CreateBusinessApplicationDto) {
    return this.service.create(dto);
  }
}
