import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DiscountMode, OfferStatus, OrderStatus, Prisma, Role } from "@prisma/client";
import { currentDiscountPercent, Paginated, zonedParts } from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { ListOffersQueryDto } from "./dto/list-offers.query";
import { NearbyOffersQueryDto } from "./dto/nearby-offers.query";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";
import { assertValidPickupWindow } from "./pickup-window";
import { assertFoodInfo } from "./food-info";
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

    assertValidPickupWindow(new Date(dto.pickupStart), new Date(dto.pickupEnd), { requireFuture: true, hours: { workingHours: business.workingHours, timezone: business.timezone } });
    assertFoodInfo(
      {
        category: dto.category,
        ingredients: dto.ingredients,
        allergens: dto.allergens,
        bestBefore: dto.bestBefore ? new Date(dto.bestBefore) : null,
        pickupEnd: new Date(dto.pickupEnd),
      },
      true
    );

    const originalPrice = Math.round(dto.originalPriceRub * 100);
    const hoursToEnd = (new Date(dto.pickupEnd).getTime() - Date.now()) / (1000 * 60 * 60);
    const discountMode = dto.discountMode ?? DiscountMode.DYNAMIC;
    const discountPercent = currentDiscountPercent(discountMode, dto.baseDiscountPercent, hoursToEnd);
    const discountedPrice = Math.round((originalPrice * (100 - discountPercent)) / 100);

    return this.prisma.offer.create({
      data: {
        businessId: dto.businessId,
        discountMode,
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
        ingredients: dto.ingredients?.trim() || null,
        allergens: dto.allergens ?? [],
        allergensDeclared: dto.allergens !== undefined,
        bestBefore: dto.bestBefore ? new Date(dto.bestBefore) : null,
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
      const windowChanged = pickupStart.getTime() !== offer.pickupStart.getTime() || pickupEnd.getTime() !== offer.pickupEnd.getTime();
      assertValidPickupWindow(pickupStart, pickupEnd, {
        requireFuture: !!dto.pickupEnd,
        hours: { workingHours: offer.business.workingHours, timezone: offer.business.timezone },
        checkHours: windowChanged,
      });
    }
    if (dto.pickupEnd) data.pickupEnd = pickupEnd;

    // Состав/аллергены/срок годности: если правят сами эти поля или категорию — всё обязательно (для еды);
    // иначе проверяем лишь согласованность (старый оффер без состава можно снять с продажи).
    const touchesFoodInfo =
      dto.ingredients !== undefined || dto.allergens !== undefined || dto.bestBefore !== undefined || dto.category !== undefined;
    const bestBefore = dto.bestBefore ? new Date(dto.bestBefore) : offer.bestBefore;
    assertFoodInfo(
      {
        category: dto.category ?? offer.category,
        ingredients: dto.ingredients ?? offer.ingredients,
        allergens: dto.allergens ?? (offer.allergensDeclared ? offer.allergens : undefined),
        bestBefore,
        pickupEnd,
      },
      touchesFoodInfo
    );
    if (dto.ingredients !== undefined) data.ingredients = dto.ingredients.trim() || null;
    if (dto.allergens !== undefined) {
      data.allergens = dto.allergens;
      data.allergensDeclared = true;
    }
    if (dto.bestBefore !== undefined) data.bestBefore = bestBefore;

    const originalPrice =
      dto.originalPriceRub !== undefined ? Math.round(dto.originalPriceRub * 100) : offer.originalPrice;
    if (dto.originalPriceRub !== undefined) data.originalPrice = originalPrice;

    const baseDiscountPercent = dto.baseDiscountPercent ?? offer.baseDiscountPercent;
    if (dto.baseDiscountPercent !== undefined) data.baseDiscountPercent = baseDiscountPercent;

    const discountMode = dto.discountMode ?? offer.discountMode;
    if (dto.discountMode !== undefined) data.discountMode = discountMode;

    // Скидку и цену со скидкой пересчитываем сразу, если поменялось что-то, что
    // на них влияет (в том числе режим) — не ждём следующего тика шедулера (раз в 15 минут).
    if (dto.baseDiscountPercent !== undefined || dto.pickupEnd !== undefined || dto.originalPriceRub !== undefined || dto.discountMode !== undefined) {
      const hoursToEnd = (pickupEnd.getTime() - Date.now()) / (1000 * 60 * 60);
      const discountPercent = currentDiscountPercent(discountMode, baseDiscountPercent, hoursToEnd);
      data.discountPercent = discountPercent;
      data.discountedPrice = Math.round((originalPrice * (100 - discountPercent)) / 100);
    }

    // Количество: правка двигает остаток на ту же разницу, проданное не трогается.
    // Уменьшение защищено условием в БД — заказ, оформленный между чтением и записью, не уведёт остаток в минус.
    if (dto.quantityTotal !== undefined && dto.quantityTotal !== offer.quantityTotal) {
      const delta = dto.quantityTotal - offer.quantityTotal;
      const sold = offer.quantityTotal - offer.quantityLeft;
      if (dto.quantityTotal < sold) {
        throw new BadRequestException(`Уже продано ${sold} — всего не может быть меньше`);
      }
      const changed = await this.prisma.offer.updateMany({
        where: { id, quantityLeft: { gte: Math.max(0, -delta) } },
        data: { quantityTotal: dto.quantityTotal, quantityLeft: { increment: delta } },
      });
      if (changed.count === 0) {
        throw new ConflictException("Пока вы правили, часть порций раскупили — обновите страницу и попробуйте снова");
      }
      const left = offer.quantityLeft + delta;
      // Раскупленный оффер с добавленными порциями снова в продаже; последние порции убрали — «раскуплен».
      if (dto.status === undefined) {
        if (offer.status === OfferStatus.SOLD_OUT && left > 0 && pickupEnd.getTime() > Date.now()) data.status = OfferStatus.ACTIVE;
        if (offer.status === OfferStatus.ACTIVE && left === 0) data.status = OfferStatus.SOLD_OUT;
      }
    }

    const updated = await this.prisma.offer.update({ where: { id }, data });
    // Фото заменили или сняли — старый загруженный файл больше не нужен (фото из библиотеки/Unsplash общие, их не трогаем).
    if (dto.imageUrl !== undefined && dto.imageUrl !== offer.imageUrl) await this.deletePhotoIfUnused(offer.imageUrl);
    return updated;
  }

  /**
   * Ручное удаление. Пока заказов нет — удаляем из любого статуса (в том числе прямо с витрины).
   * Есть заказы — нельзя: это история денег и выдач (Order.offerId — Restrict), оффер остаётся в архиве.
   * Если оффер выложен автовыкладкой на сегодня или позже, его дату вносим в пропуски шаблона, иначе
   * следующий запуск создал бы такой же оффер заново.
   */
  async remove(id: string, requester: RequestUser) {
    const offer = await this.findOneWithBusiness(id);
    this.assertOwnerOrAdmin(offer.business.ownerUserId, requester);

    const orders = await this.prisma.order.groupBy({ by: ["status"], where: { offerId: id }, _count: { _all: true } });
    const inWork = orders.find((group) => group.status === OrderStatus.CONFIRMED)?._count._all ?? 0;
    if (inWork > 0) {
      throw new ConflictException(`По офферу есть заказы в работе (${inWork}) — дождитесь выдачи или отмены, потом удаляйте`);
    }
    if (orders.length > 0) {
      throw new ConflictException("По офферу уже были заказы — их история остаётся в отчётах, поэтому удалить его нельзя. Уберите оффер в архив.");
    }

    let skippedDate: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      await tx.offer.delete({ where: { id } });
      if (offer.scheduleId && offer.occurrenceDate) {
        const schedule = await tx.offerSchedule.findUnique({ where: { id: offer.scheduleId } });
        if (schedule) {
          const today = zonedParts(Date.now(), schedule.timezone).date;
          if (offer.occurrenceDate >= today) {
            const skipDates = [...new Set([...schedule.skipDates.filter((date) => date >= today), offer.occurrenceDate])].sort();
            await tx.offerSchedule.update({ where: { id: schedule.id }, data: { skipDates } });
            skippedDate = offer.occurrenceDate;
          }
        }
      }
    });
    await this.deletePhotoIfUnused(offer.imageUrl);
    return { success: true, skippedDate };
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
