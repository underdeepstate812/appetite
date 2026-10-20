import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { OfferSchedulesService } from "./offer-schedules.service";
import { CreateOfferScheduleDto, SkipDateDto, UpdateOfferScheduleDto } from "./dto/offer-schedule.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

/** Шаблоны автовыкладки — только владелец заведения и админ платформы. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BUSINESS, Role.ADMIN)
@Controller("offer-schedules")
export class OfferSchedulesController {
  constructor(private readonly schedules: OfferSchedulesService) {}

  @Get()
  list(@Query("businessId", ParseUUIDPipe) businessId: string, @CurrentUser() user: RequestUser) {
    return this.schedules.list(businessId, user);
  }

  @Post()
  create(@Body() dto: CreateOfferScheduleDto, @CurrentUser() user: RequestUser) {
    return this.schedules.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateOfferScheduleDto, @CurrentUser() user: RequestUser) {
    return this.schedules.update(id, dto, user);
  }

  /** Пропустить выкладку на дату. */
  @Post(":id/skip")
  skip(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SkipDateDto, @CurrentUser() user: RequestUser) {
    return this.schedules.skip(id, dto.date, user);
  }

  /** Вернуть пропущенную дату в расписание. */
  @Delete(":id/skip/:date")
  unskip(@Param("id", ParseUUIDPipe) id: string, @Param("date") date: string, @CurrentUser() user: RequestUser) {
    return this.schedules.unskip(id, date, user);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.schedules.remove(id, user);
  }
}
