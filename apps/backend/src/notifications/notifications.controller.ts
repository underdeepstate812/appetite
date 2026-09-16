import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { NotificationsService } from "./notifications.service";
import { NotificationsSchedulerService } from "./notifications-scheduler.service";
import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import { ListNotificationsQueryDto } from "./dto/list-notifications.query";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsScheduler: NotificationsSchedulerService
  ) {}

  @Post("push-token")
  registerPushToken(@Body() dto: RegisterPushTokenDto, @CurrentUser() user: RequestUser) {
    return this.notificationsService.registerPushToken(user.userId, dto.token);
  }

  @Get()
  findMine(@Query() query: ListNotificationsQueryDto, @CurrentUser() user: RequestUser) {
    return this.notificationsService.findMine(user.userId, query);
  }

  @Patch(":id/read")
  markRead(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.markRead(id, user.userId);
  }

  /** Ручной запуск гео-дайджеста и напоминаний о самовывозе — для отладки/демо. */
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post("run-digest")
  runDigest() {
    return this.notificationsScheduler.run();
  }
}
