import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OfferStatus, Role } from "@prisma/client";
import { DISCOUNT_RULES, Paginated } from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { ListOffersQueryDto } from "./dto/list-offers.query";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOfferDto, requester: RequestUser) {
    const business = await this.prisma.business.findUnique({ where: { id: dto.businessId } });
    if (!business) throw new NotFoundException("Заведение не найдено");
    this.assertOwnerOrAdmin(business.ownerUserId, requester);

    const originalPrice = Math.round(dto.originalPriceRub * 100);
    const discountPercent = DISCOUNT_RULES.BASE_PERCENT;
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
        quantityTotal: dto.quantityTotal,
        quantityLeft: dto.quantityTotal,
        weightKg: dto.weightKg,
        pickupStart: new Date(dto.pickupStart),
        pickupEnd: new Date(dto.pickupEnd),
        status: OfferStatus.ACTIVE,
      },
    });
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

  async update(id: string, dto: UpdateOfferDto, requester: RequestUser) {
    const offer = await this.findOneWithBusiness(id);
    this.assertOwnerOrAdmin(offer.business.ownerUserId, requester);

    const data: Record<string, unknown> = {
      title: dto.title,
      description: dto.description,
      category: dto.category,
      weightKg: dto.weightKg,
      status: dto.status,
    };
    if (dto.pickupStart) data.pickupStart = new Date(dto.pickupStart);
    if (dto.pickupEnd) data.pickupEnd = new Date(dto.pickupEnd);

    if (dto.originalPriceRub !== undefined) {
      const originalPrice = Math.round(dto.originalPriceRub * 100);
      data.originalPrice = originalPrice;
      data.discountedPrice = Math.round((originalPrice * (100 - offer.discountPercent)) / 100);
    }

    return this.prisma.offer.update({ where: { id }, data });
  }

  async remove(id: string, requester: RequestUser) {
    const offer = await this.findOneWithBusiness(id);
    this.assertOwnerOrAdmin(offer.business.ownerUserId, requester);
    await this.prisma.offer.delete({ where: { id } });
    return { success: true };
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
