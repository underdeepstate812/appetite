import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Role } from "@prisma/client";
import { MAX_OFFER_PHOTO_BYTES } from "./offer-photo";
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

  /** Библиотека фото по умолчанию — для выбора вместо собственной загрузки. Объявлен ДО ":id", иначе "photo-presets" примется за id. */
  @Get("photo-presets")
  photoPresets() {
    return this.offersService.photoPresets();
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.offersService.findOne(id);
  }

  /**
   * Загрузка собственного фото оффера (multipart, поле "photo"). Возвращает { imageUrl } — его форма затем
   * передаёт в создание/редактирование оффера. Файл проверяется по сигнатуре, а не по заявленному типу.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @Post("photo")
  @UseInterceptors(FileInterceptor("photo", { storage: memoryStorage(), limits: { fileSize: MAX_OFFER_PHOTO_BYTES, files: 1 } }))
  uploadPhoto(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("Файл не получен");
    return this.offersService.uploadPhoto(file.buffer);
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
