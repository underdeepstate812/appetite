import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Business, BusinessStatus, OfferCategory, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";
import { RequestUser } from "../common/interfaces/authenticated-request.interface";

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBusinessDto) {
    const existingOwner = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (existingOwner) {
      throw new ConflictException("Пользователь с таким email уже существует");
    }

    const passwordHash = await bcrypt.hash(dto.ownerPassword, PASSWORD_SALT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          email: dto.ownerEmail,
          passwordHash,
          name: dto.ownerName,
          role: Role.BUSINESS,
        },
      });

      return tx.business.create({
        data: {
          ownerUserId: owner.id,
          name: dto.name,
          description: dto.description,
          category: dto.category,
          address: dto.address,
          lat: dto.lat,
          lng: dto.lng,
          // Ручной онбординг админом (ШАГ 0) — заведение уже провалидировано, сразу ACTIVE.
          status: BusinessStatus.ACTIVE,
        },
      });
    });
  }

  findAll(category?: OfferCategory) {
    return this.prisma.business.findMany({
      where: category ? { category } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  findMine(ownerUserId: string) {
    return this.prisma.business.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException("Заведение не найдено");
    return business;
  }

  async update(id: string, dto: UpdateBusinessDto, requester: RequestUser) {
    const business = await this.findOne(id);
    this.assertOwnerOrAdmin(business.ownerUserId, requester);

    const data = { ...dto };
    if (requester.role !== Role.ADMIN) {
      delete data.status;
    }

    return this.prisma.business.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.business.delete({ where: { id } });
    return { success: true };
  }

  private assertOwnerOrAdmin(ownerUserId: string, requester: RequestUser) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.BUSINESS && requester.userId === ownerUserId) return;
    throw new ForbiddenException("Недостаточно прав для этого заведения");
  }
}
