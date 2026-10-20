import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { defaultWorkingHours, zonedTimeToUtc } from "@apetite/shared";
import { BusinessesService } from "./businesses.service";
import type { RequestUser } from "../common/interfaces/authenticated-request.interface";

const owner = { userId: "owner", role: Role.BUSINESS } as RequestUser;
const stranger = { userId: "x", role: Role.BUSINESS } as RequestUser;
const business = { id: "b", ownerUserId: "owner", timezone: "Europe/Moscow" };
const msk = (date: string, time: string) => zonedTimeToUtc(date, time, "Europe/Moscow");

function setup(offers: unknown[] = [], schedules: unknown[] = []) {
  const prisma = {
    business: { findUnique: jest.fn().mockResolvedValue(business), update: jest.fn().mockImplementation(async ({ data }: { data: object }) => ({ ...business, ...data })) },
    offer: { findMany: jest.fn().mockResolvedValue(offers) },
    offerSchedule: { findMany: jest.fn().mockResolvedValue(schedules) },
  };
  return { prisma, service: new BusinessesService(prisma as never) };
}

describe("BusinessesService.setWorkingHours", () => {
  it("сохраняет полный набор дней, выходные — null", async () => {
    const { service, prisma } = setup();
    await service.setWorkingHours("b", { "1": { open: "09:00", close: "18:00" } }, owner);
    expect(prisma.business.update.mock.calls[0][0].data.workingHours).toEqual({ "1": { open: "09:00", close: "18:00" }, "2": null, "3": null, "4": null, "5": null, "6": null, "7": null });
  });
  it("плохой формат — 400, ничего не сохранено", async () => {
    const { service, prisma } = setup();
    await expect(service.setWorkingHours("b", { "1": { open: "9", close: "18:00" } }, owner)).rejects.toThrow(BadRequestException);
    await expect(service.setWorkingHours("b", {}, owner)).rejects.toThrow(/хотя бы один/);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });
  it("null снимает ограничение, конфликтов нет", async () => {
    const { service, prisma } = setup();
    const result = await service.setWorkingHours("b", null, owner);
    expect(prisma.business.update.mock.calls[0][0].data.workingHours).toBeDefined();
    expect(result.conflicts).toEqual({ offers: [], schedules: [] });
  });
  it("чужое заведение — 403", async () => {
    const { service } = setup();
    await expect(service.setWorkingHours("b", defaultWorkingHours(), stranger)).rejects.toThrow(ForbiddenException);
  });
  it("сообщает, какие активные офферы и шаблоны не влезают в новые часы (но не трогает их)", async () => {
    const { service, prisma } = setup(
      [
        { id: "o1", title: "Вечерний набор", pickupStart: msk("2026-10-19", "19:00"), pickupEnd: msk("2026-10-19", "23:30") },
        { id: "o2", title: "Дневной набор", pickupStart: msk("2026-10-19", "12:00"), pickupEnd: msk("2026-10-19", "15:00") },
      ],
      [
        { id: "s1", title: "Завтрак", daysOfWeek: [1, 2], pickupStartTime: "07:00", pickupEndTime: "10:00" },
        { id: "s2", title: "Обед", daysOfWeek: [1, 2], pickupStartTime: "13:00", pickupEndTime: "15:00" },
      ]
    );
    const result = await service.setWorkingHours("b", defaultWorkingHours(), owner); // 10:00–22:00 каждый день
    expect(result.conflicts.offers.map((x) => x.id)).toEqual(["o1"]);
    expect(result.conflicts.offers[0].reason).toMatch(/закрывается в 22:00/);
    expect(result.conflicts.schedules.map((x) => x.id)).toEqual(["s1"]);
    expect(result.conflicts.schedules[0].reason).toMatch(/открывается в 10:00/);
    expect(prisma.business.update).toHaveBeenCalledTimes(1); // только часы; офферы/шаблоны не менялись
  });
});
