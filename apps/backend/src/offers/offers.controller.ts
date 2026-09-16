import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { OffersService } from "./offers.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { ListOffersQueryDto } from "./dto/list-offers.query";
import { NearbyOffersQueryDto } from "./dto/nearby-offers.query";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

@Controller("offers")
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  findAll(@Query() query: ListOffersQueryDto) {
    return this.offersService.findAll(query);
  }

  @Get("nearby")
  findNearby(@Query() query: NearbyOffersQueryDto) {
    return this.offersService.findNearby(query);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.offersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @Post()
  create(@Body() dto: CreateOfferDto, @CurrentUser() user: RequestUser) {
    return this.offersService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.offersService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.offersService.remove(id, user);
  }
}
