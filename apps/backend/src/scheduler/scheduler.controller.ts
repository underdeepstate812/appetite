import { Controller, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { DiscountSchedulerService } from "./discount-scheduler.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("scheduler")
export class SchedulerController {
  constructor(private readonly discountScheduler: DiscountSchedulerService) {}

  /** Ручной запуск для отладки/демо — в норме шедулер срабатывает сам по крону каждые 15 минут. */
  @Post("run-discounts")
  runDiscounts() {
    return this.discountScheduler.run();
  }
}
