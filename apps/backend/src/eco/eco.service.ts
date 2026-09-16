import { Injectable } from "@nestjs/common";
import { getEcoLevel, getNextEcoLevel, type EcoSummary } from "@apetite/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EcoService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string): Promise<EcoSummary> {
    const aggregate = await this.prisma.ecoTransaction.aggregate({
      where: { userId },
      _sum: { points: true, weightSavedKg: true },
      _count: { _all: true },
    });

    const totalPoints = aggregate._sum.points ?? 0;
    const totalWeightSavedKg = aggregate._sum.weightSavedKg ?? 0;

    return {
      totalPoints,
      totalWeightSavedKg,
      ordersCompleted: aggregate._count._all,
      level: getEcoLevel(totalPoints),
      nextLevel: getNextEcoLevel(totalPoints),
    };
  }
}
