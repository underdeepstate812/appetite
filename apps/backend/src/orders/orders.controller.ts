import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { CompleteOrderDto } from "./dto/complete-order.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: RequestUser) {
    return this.ordersService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.ordersService.findAll(user);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.ordersService.findOne(id, user);
  }

  @Get(":id/qrcode")
  getQrCode(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.ordersService.getQrCode(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.ADMIN)
  @Patch(":id/cancel")
  cancel(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.ordersService.cancel(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @Patch(":id/complete")
  complete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CompleteOrderDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.ordersService.complete(id, dto, user);
  }
}
