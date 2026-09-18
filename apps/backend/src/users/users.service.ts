import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "../common/utils/public-user";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Мобильное приложение (ШАГ 9) шлёт сюда геопозицию — основа гео-триггера NEARBY_OFFERS. */
  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { lastLat: dto.lat, lastLng: dto.lng },
    });
    return toPublicUser(user);
  }

  /** Имя/email — телефон намеренно не редактируется (нужен для входа/заказов). */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing && existing.id !== userId) {
        throw new ConflictException("Этот email уже используется другим аккаунтом");
      }
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, email: dto.email },
    });
    return toPublicUser(user);
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
    return toPublicUser(user);
  }
}
