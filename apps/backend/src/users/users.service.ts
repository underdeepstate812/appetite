import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "../common/utils/public-user";
import { UpdateLocationDto } from "./dto/update-location.dto";

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
}
