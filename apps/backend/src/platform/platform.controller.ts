import { Controller, Get, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PlatformService } from "./platform.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

/** Платформенная сводка (ШАГ 11) — модерация заведений + GMV/комиссия по всей платформе. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("platform")
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get("businesses")
  listBusinesses() {
    return this.platformService.listBusinesses();
  }

  @Get("stats")
  getStats() {
    return this.platformService.getStats();
  }
}
