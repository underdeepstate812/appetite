import { Controller, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { DiscountSchedulerService } from "./discount-scheduler.service";
import { OfferSchedulesMaterializer } from "../offer-schedules/offer-schedules.materializer";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("scheduler")
export class SchedulerController {
  constructor(
    private readonly discountScheduler: DiscountSchedulerService,
    private readonly materializer: OfferSchedulesMaterializer
  ) {}

  /** Ручной запуск для отладки/демо — в норме шедулер срабатывает сам по крону каждые 15 минут. */
  @Post("run-discounts")
  runDiscounts() {
    return this.discountScheduler.run();
  }

  /** Ручной запуск автовыкладки по шаблонам (в норме — по крону раз в 5 минут). */
  @Post("run-schedules")
  runSchedules() {
    return this.materializer.run();
  }
}
