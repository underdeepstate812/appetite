import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OfferSchedulesService, type MaterializeResult } from "./offer-schedules.service";

/** Раз в 5 минут выкладывает офферы по шаблонам, время которых пришло (см. OfferSchedulesService.materialize). */
@Injectable()
export class OfferSchedulesMaterializer {
  private readonly logger = new Logger(OfferSchedulesMaterializer.name);
  private running = false;

  constructor(private readonly schedules: OfferSchedulesService) {}

  // Выражение берём из env напрямую по той же причине, что у DiscountSchedulerService (декоратор вычисляется до DI).
  @Cron(process.env.SCHEDULE_CRON_EXPRESSION ?? "*/5 * * * *")
  async handleCron() {
    const result = await this.run();
    if (result.created > 0) this.logger.log(`Автовыкладка: создано ${result.created} из ${result.checked} шаблонов`);
    if (result.skippedOutsideHours > 0) this.logger.warn(`Автовыкладка: ${result.skippedOutsideHours} выкладок не вошли в часы работы заведения и пропущены`);
  }

  /** Без наложения: если прошлый прогон ещё идёт (медленная БД), новый пропускаем — следующий тик догонит. */
  async run(now: number = Date.now()): Promise<MaterializeResult> {
    if (this.running) return { created: 0, checked: 0, skippedOutsideHours: 0 };
    this.running = true;
    try {
      return await this.schedules.materialize(now);
    } catch (error) {
      this.logger.error(`Автовыкладка не отработала: ${(error as Error).message}`);
      return { created: 0, checked: 0, skippedOutsideHours: 0 };
    } finally {
      this.running = false;
    }
  }
}
