import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OfferStatus, Prisma, Role } from "@prisma/client";
import { computeDiscountPercent, Paginated } from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { ListOffersQueryDto } from "./dto/list-offers.query";
import { NearbyOffersQueryDto } from "./dto/nearby-offers.query";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";
import { assertValidPickupWindow } from "./pickup-window";
import { deleteUploadedOfferPhoto, detectImageKind, saveOfferPhoto } from "./offer-photo";
import { OFFER_PHOTO_PRESETS } from "./offer-photo-presets";

const DEFAULT_PAGE_SIZE = 20;
const NEARBY_RESULTS_LIMIT = 100;

interface NearbyOfferRow {
  id: string;
  businessId: string;
  title: string;
  description: string | null;
  category: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  quantityTotal: number;
  quantityLeft: number;
  weightKg: number;
  pickupStart: Date;
  pickupEnd: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  businessName: string;
  businessAddress: string;
  businessLat: number;
  businessLng: number;
  businessLogoUrl: string | null;
  distanceKm: number;
}

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOfferDto, requester: RequestUser) {
    const business = await this.prisma.business.findUnique({ where: { id: dto.businessId } });
    if (!business) throw new NotFoundException("Заведение не найдено");
    this.assertOwnerOrAdmin(business.ownerUserId, requester);

    assertValidPickupWindow(new Date(dto.pickupStart), new Date(dto.pickupEnd), { requireFuture: true });

    const originalPrice = Math.round(dto.originalPriceRub * 100);
    const hoursToEnd = (new Date(dto.pickupEnd).getTime() - Date.now()) / (1000 * 60 * 60);
    const discountPercent = computeDiscountPercent(dto.baseDiscountPercent, hoursToEnd);
    const discountedPrice = Math.round((originalPrice * (100 - discountPercent)) / 100);

    return this.prisma.offer.create({
      data: {
        businessId: dto.businessId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        originalPrice,
        discountedPrice,
        discountPercent,
        baseDiscountPercent: dto.baseDiscountPercent,
        imageUrl: dto.imageUrl,
        quantityTotal: dto.quantityTotal,
        quantityLeft: dto.quantityTotal,
        weightKg: dto.weightKg,
        pickupStart: new Date(dto.pickupStart),
        pickupEnd: new Date(dto.pickupEnd),
        status: OfferStatus.ACTIVE,
      },
    });
  }

  photoPresets() {
    return OFFER_PHOTO_PRESETS;
  }

  async uploadPhoto(buffer: Buffer) {
    const kind = detectImageKind(buffer);
    if (!kind) throw new BadRequestException("Разрешены только изображения JPEG, PNG или WebP");
    return { imageUrl: await saveOfferPhoto(buffer, kind) };
  }

  async findAll(query: ListOffersQueryDto): Promise<Paginated<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const where = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.businessId ? { businessId: query.businessId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({
        where,
        orderBy: { pickupEnd: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.offer.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException("Оффер не найден");
    return offer;
  }

  /**
   * Haversine-поиск активных офферов в радиусе от точки. MVP на raw SQL — для
   * реального масштаба заменяется на PostGIS (ST_DWithin + GiST-индекс), см. ШАГ 0.
   */
  async findNearby(query: NearbyOffersQueryDto): Promise<NearbyOfferRow[]> {
    const categoryFilter = query.category
      ? Prisma.sql`AND o."category" = ${query.category}::"OfferCategory"`
      : Prisma.empty;
    const minDiscountFilter =
      query.minDiscount !== undefined
        ? Prisma.sql`AND o."discountPercent" >= ${query.minDiscount}`
        : Prisma.empty;

    return this.prisma.$queryRaw<NearbyOfferRow[]>(Prisma.sql`
      SELECT * FROM (
        SELECT
          o.*,
          b."name" AS "businessName",
          b."address" AS "businessAddress",
          b."lat" AS "businessLat",
          b."lng" AS "businessLng",
          b."logoUrl" AS "businessLogoUrl",
          (
            6371 * acos(
              LEAST(1, GREATEST(-1,
                cos(radians(${query.lat})) * cos(radians(b."lat")) * cos(radians(b."lng") - radians(${query.lng}))
                + sin(radians(${query.lat})) * sin(radians(b."lat"))
              ))
            )
          ) AS "distanceKm"
        FROM "offers" o
        JOIN "businesses" b ON b."id" = o."businessId"
        WHERE o."status" = 'ACTIVE'
          ${categoryFilter}
          ${minDiscountFilter}
      ) nearby
      WHERE nearby."distanceKm" <= ${query.radiusKm}
      ORDER BY nearby."distanceKm" ASC
      LIMIT ${NEARBY_RESULTS_LIMIT}
    `);
  }

  async update(id: string, dto: UpdateOfferDto, requester: RequestUser) {
    const offer = await this.findOneWithBusiness(id);
    this.assertOwnerOrAdmin(offer.business.ownerUserId, requester);

    const data: Record<string, unknown> = {
      title: dto.title,
      description: dto.description,
      category: dto.category,
      weightKg: dto.weightKg,
      status: dto.status,
      imageUrl: dto.imageUrl,
    };
    if (dto.pickupStart) data.pickupStart = new Date(dto.pickupStart);

    const pickupEnd = dto.pickupEnd ? new Date(dto.pickupEnd) : offer.pickupEnd;
    if (dto.pickupStart || dto.pickupEnd) {
      // Порядок концов проверяем по итоговым значениям (что-то из пары могло остаться прежним);
      // "конец в будущем" требуем только когда конец переносят, иначе нельзя было бы архивировать старый оффер.
      const pickupStart = dto.pickupStart ? new Date(dto.pickupStart) : offer.pickupStart;
      assertValidPickupWindow(pickupStart, pickupEnd, { requireFuture: !!dto.pickupEnd });
    }
    if (dto.pickupEnd) data.pickupEnd = pickupEnd;

    const originalPrice =
      dto.originalPriceRub !== undefined ? Math.round(dto.originalPriceRub * 100) : offer.originalPrice;
    if (dto.originalPriceRub !== undefined) data.originalPrice = originalPrice;

    const baseDiscountPercent = dto.baseDiscountPercent ?? offer.baseDiscountPercent;
    if (dto.baseDiscountPercent !== undefined) data.baseDiscountPercent = baseDiscountPercent;

    // Скидку и цену со скидкой пересчитываем сразу, если поменялось что-то, что
    // на них влияет — не ждём следующего тика шедулера (раз в 15 минут).
    if (dto.baseDiscountPercent !== undefined || dto.pickupEnd !== undefined || dto.originalPriceRub !== undefined) {
      const hoursToEnd = (pickupEnd.getTime() - Date.now()) / (1000 * 60 * 60);
      const discountPercent = computeDiscountPercent(baseDiscountPercent, hoursToEnd);
      data.discountPercent = discountPercent;
      data.discountedPrice = Math.round((originalPrice * (100 - discountPercent)) / 100);
    }

    const updated = await this.prisma.offer.update({ where: { id }, data });
    // Фото заменили или сняли — старый загруженный файл больше не нужен (фото из библиотеки/Unsplash общие, их не трогаем).
    if (dto.imageUrl !== undefined && dto.imageUrl !== offer.imageUrl) await this.deletePhotoIfUnused(offer.imageUrl);
    return updated;
  }

  async remove(id: string, requester: RequestUser) {
    const offer = await this.findOneWithBusiness(id);
    this.assertOwnerOrAdmin(offer.business.ownerUserId, requester);
    await this.prisma.offer.delete({ where: { id } });
    await this.deletePhotoIfUnused(offer.imageUrl);
    return { success: true };
  }

  /** Удаляет загруженный файл, только если на него не ссылается другой оффер. */
  private async deletePhotoIfUnused(url: string | null) {
    if (!url) return;
    const stillUsed = await this.prisma.offer.count({ where: { imageUrl: url } });
    if (stillUsed === 0) await deleteUploadedOfferPhoto(url);
  }

  private async findOneWithBusiness(id: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id }, include: { business: true } });
    if (!offer) throw new NotFoundException("Оффер не найден");
    return offer;
  }

  private assertOwnerOrAdmin(ownerUserId: string, requester: RequestUser) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.BUSINESS && requester.userId === ownerUserId) return;
    throw new ForbiddenException("Недостаточно прав для этого оффера");
  }
}
