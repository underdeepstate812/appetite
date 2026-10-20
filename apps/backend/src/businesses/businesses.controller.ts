import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { BusinessesService } from "./businesses.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";
import { ListBusinessesQueryDto } from "./dto/list-businesses.query";
import { SalesQueryDto } from "./dto/sales.query";
import { UpdateWorkingHoursDto } from "./dto/working-hours.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  findAll(@Query() query: ListBusinessesQueryDto) {
    return this.businessesService.findAll(query.category);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS)
  @Get("mine")
  findMine(@CurrentUser() user: RequestUser) {
    return this.businessesService.findMine(user.userId);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.businessesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @Get(":id/stats")
  getStats(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.businessesService.getStats(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @Get(":id/sales")
  getSales(@Param("id", ParseUUIDPipe) id: string, @Query() query: SalesQueryDto, @CurrentUser() user: RequestUser) {
    return this.businessesService.getSales(id, query.days ?? 14, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @Put(":id/working-hours")
  setWorkingHours(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateWorkingHoursDto, @CurrentUser() user: RequestUser) {
    return this.businessesService.setWorkingHours(id, dto.workingHours ?? null, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.businessesService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.businessesService.remove(id);
  }
}
