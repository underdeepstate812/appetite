import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { NotificationType, OrderStatus, Role } from "@prisma/client";
import { OrdersService } from "./orders.service";
import type { RequestUser } from "../common/interfaces/authenticated-request.interface";

/**
 * cancel()/accept()/complete() все читают заказ, проверяют его состояние, а потом пишут —
 * классическое окно для гонки, если два запроса (покупатель отменяет, заведение принимает/
 * выдаёт) приходят почти одновременно. Защита — условный updateMany() внутри транзакции
 * (affected === 0 значит кто-то успел раньше), а не просто update() после проверки в памяти.
 * Эти тесты в первую очередь закрепляют именно это — без них гонка молча проезжает мимо
 * всех остальных зелёных тестов.
 */
function createPrismaMock() {
  const delegates = {
    order: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    offer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    ecoTransaction: {
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };
  return {
    ...delegates,
    // Методы ниже не вкладывают транзакции друг в друга — достаточно прогнать callback
    // с теми же delegate-моками вместо настоящего изолированного tx-клиента.
    $transaction: jest.fn(async (callback: (tx: typeof delegates) => unknown) => callback(delegates)),
  };
}

describe("OrdersService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let notifications: { dispatchPush: jest.Mock };
  let service: OrdersService;

  const baseOrder = {
    id: "order-1",
    userId: "user-1",
    offerId: "offer-1",
    businessId: "biz-1",
    quantity: 1,
    totalPrice: 10000,
    platformFee: 2500,
    status: OrderStatus.CONFIRMED,
    pickupCode: "123456",
    acceptedAt: null as Date | null,
    business: { id: "biz-1", ownerUserId: "owner-1" },
    offer: { id: "offer-1", title: "Тестовый оффер", weightKg: 1 },
  };

  const buyer: RequestUser = { userId: "user-1", email: "buyer@test.ru", role: Role.USER };
  const businessOwner: RequestUser = { userId: "owner-1", email: "owner@test.ru", role: Role.BUSINESS };

  beforeEach(() => {
    prisma = createPrismaMock();
    notifications = { dispatchPush: jest.fn() };
    // payments не используется ни одним из методов ниже (cancel/accept/complete) — null достаточно.
    service = new OrdersService(prisma as never, null as never, notifications as never);
    prisma.offer.findUnique.mockResolvedValue({ status: "ACTIVE", quantityLeft: 1 });
  });

  describe("cancel", () => {
    const admin: RequestUser = { userId: "admin-1", email: "a@a.ru", role: Role.ADMIN };

    // Бизнес-правило: оплата — финальная точка, покупатель отменить заказ уже не может
    // ни при каких условиях. Отмена — только у поддержки (ADMIN), как исключение.
    it("отказывает покупателю сразу — даже не читая заказ", async () => {
      await expect(service.cancel("order-1", buyer)).rejects.toThrow(ForbiddenException);
      expect(prisma.order.findUnique).not.toHaveBeenCalled();
    });

    it("отказывает владельцу заведения — тоже не поддержка", async () => {
      await expect(service.cancel("order-1", businessOwner)).rejects.toThrow(ForbiddenException);
    });

    it("ADMIN: отказывает, если заказ не найден", async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.cancel("order-1", admin)).rejects.toThrow(NotFoundException);
    });

    it("ADMIN: отказывает, если статус уже не CONFIRMED", async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, status: OrderStatus.COMPLETED });
      await expect(service.cancel("order-1", admin)).rejects.toThrow(ConflictException);
    });

    it("ADMIN: ловит гонку с complete(): updateMany вернул 0 задетых строк — отмена отклоняется, остаток не трогаем", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder); // на момент чтения ещё CONFIRMED
      prisma.order.updateMany.mockResolvedValue({ count: 0 }); // но complete() успел первым внутри транзакции
      await expect(service.cancel("order-1", admin)).rejects.toThrow(ConflictException);
      expect(prisma.offer.update).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("ADMIN: отменяет, возвращает остаток и уведомляет и заведение, и покупателя", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: OrderStatus.CANCELLED });

      const result = await service.cancel("order-1", admin);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order-1", status: OrderStatus.CONFIRMED },
        data: { status: OrderStatus.CANCELLED },
      });
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: baseOrder.offerId },
        data: { quantityLeft: { increment: baseOrder.quantity } },
      });
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: NotificationType.ORDER_CANCELLED, userId: baseOrder.business.ownerUserId }),
        })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: NotificationType.ORDER_CANCELLED, userId: baseOrder.userId }),
        })
      );
      expect(notifications.dispatchPush).toHaveBeenCalledWith(baseOrder.business.ownerUserId, expect.any(Object));
      expect(notifications.dispatchPush).toHaveBeenCalledWith(baseOrder.userId, expect.any(Object));
    });
  });

  describe("accept", () => {
    it("отказывает обычному пользователю", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      await expect(service.accept("order-1", buyer)).rejects.toThrow(ForbiddenException);
    });

    it("отказывает чужому заведению", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      await expect(
        service.accept("order-1", { userId: "other-owner", email: "x@x.ru", role: Role.BUSINESS })
      ).rejects.toThrow(ForbiddenException);
    });

    it("отказывает, если заказ уже принят", async () => {
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, acceptedAt: new Date() });
      await expect(service.accept("order-1", businessOwner)).rejects.toThrow(ConflictException);
    });

    it("ловит гонку с cancel(): updateMany вернул 0 задетых строк — покупателю не уходит ложное \"уже готовим\"", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder); // на момент чтения ещё CONFIRMED
      prisma.order.updateMany.mockResolvedValue({ count: 0 }); // но cancel() успел первым внутри транзакции
      await expect(service.accept("order-1", businessOwner)).rejects.toThrow(ConflictException);
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(notifications.dispatchPush).not.toHaveBeenCalled();
    });

    it("принимает заказ и уведомляет покупателя", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, acceptedAt: new Date() });

      const result = await service.accept("order-1", businessOwner);

      expect(result.acceptedAt).toBeTruthy();
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order-1", status: OrderStatus.CONFIRMED, acceptedAt: null },
        data: { acceptedAt: expect.any(Date) },
      });
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: NotificationType.ORDER_ACCEPTED, userId: baseOrder.userId }),
        })
      );
      expect(notifications.dispatchPush).toHaveBeenCalledWith(baseOrder.userId, expect.any(Object));
    });
  });

  describe("complete", () => {
    it("отказывает при неверном коде самовывоза", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      await expect(service.complete("order-1", { pickupCode: "000000" }, businessOwner)).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("ловит гонку с cancel(): updateMany вернул 0 задетых строк — эко-баллы не начисляются за отменённый заказ", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder); // на момент чтения ещё CONFIRMED
      prisma.order.updateMany.mockResolvedValue({ count: 0 }); // но cancel() успел первым внутри транзакции
      await expect(service.complete("order-1", { pickupCode: baseOrder.pickupCode }, businessOwner)).rejects.toThrow(
        ConflictException
      );
      expect(prisma.ecoTransaction.create).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("выдаёт заказ, начисляет эко-баллы и уведомляет покупателя", async () => {
      prisma.order.findUnique.mockResolvedValue(baseOrder);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: OrderStatus.COMPLETED });

      const result = await service.complete("order-1", { pickupCode: baseOrder.pickupCode }, businessOwner);

      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(prisma.ecoTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: baseOrder.userId, orderId: baseOrder.id }) })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: NotificationType.ORDER_COMPLETED, userId: baseOrder.userId }),
        })
      );
    });
  });

  describe("confirmReceipt", () => {
    const completed = { ...baseOrder, status: OrderStatus.COMPLETED, completedAt: new Date(), receiptConfirmedAt: null, receiptDisputedAt: null };
    const stranger: RequestUser = { userId: "user-2", email: "x@test.ru", role: Role.USER };

    beforeEach(() => {
      prisma.order.findUnique.mockResolvedValue(completed);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUniqueOrThrow.mockResolvedValue({ ...completed });
      prisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    });

    it("отвечать может только владелец заказа", async () => {
      await expect(service.confirmReceipt("order-1", { received: true }, stranger)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it("404, если заказа нет", async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.confirmReceipt("order-1", { received: true }, buyer)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("пока заведение не отметило выдачу, ответить нельзя", async () => {
      prisma.order.findUnique.mockResolvedValue({ ...completed, status: OrderStatus.CONFIRMED });
      await expect(service.confirmReceipt("order-1", { received: true }, buyer)).rejects.toBeInstanceOf(ConflictException);
    });

    it("ответить можно один раз: ни подтвердить, ни оспорить повторно", async () => {
      prisma.order.findUnique.mockResolvedValue({ ...completed, receiptConfirmedAt: new Date() });
      await expect(service.confirmReceipt("order-1", { received: true }, buyer)).rejects.toBeInstanceOf(ConflictException);
      prisma.order.findUnique.mockResolvedValue({ ...completed, receiptDisputedAt: new Date() });
      await expect(service.confirmReceipt("order-1", { received: false, reason: "NOT_RECEIVED" as never }, buyer)).rejects.toBeInstanceOf(ConflictException);
    });

    it("«получил»: фиксирует время подтверждения только у ещё не отвеченного заказа", async () => {
      await service.confirmReceipt("order-1", { received: true }, buyer);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order-1", receiptConfirmedAt: null, receiptDisputedAt: null },
        data: { receiptConfirmedAt: expect.any(Date) },
      });
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("ловит гонку двух ответов: updateMany вернул 0 — второй ответ отклоняется", async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.confirmReceipt("order-1", { received: true }, buyer)).rejects.toBeInstanceOf(ConflictException);
    });

    it("спор: пишет причину и пояснение, уведомляет заведение и админов", async () => {
      await service.confirmReceipt("order-1", { received: false, reason: "WRONG_ITEM" as never, note: "  Дали другую пиццу " }, buyer);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: "order-1", receiptConfirmedAt: null, receiptDisputedAt: null },
        data: { receiptDisputedAt: expect.any(Date), receiptDisputeReason: "WRONG_ITEM", receiptDisputeNote: "Дали другую пиццу" },
      });
      const recipients = prisma.notification.create.mock.calls.map(([arg]) => arg.data.userId).sort();
      expect(recipients).toEqual(["admin-1", "owner-1"]);
      expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ type: NotificationType.RECEIPT_DISPUTED, data: { orderId: "order-1" } });
      expect(prisma.notification.create.mock.calls[0][0].data.body).toContain("выдали не тот товар");
      expect(notifications.dispatchPush).toHaveBeenCalledTimes(2);
    });

    it("спор не создаёт дублей, если владелец заведения сам админ", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "owner-1" }]);
      await service.confirmReceipt("order-1", { received: false, reason: "QUALITY" as never }, buyer);
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it("спор после окна (7 дней) не принимается, а подтверждение — принимается всегда", async () => {
      const old = { ...completed, completedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000) };
      prisma.order.findUnique.mockResolvedValue(old);
      await expect(service.confirmReceipt("order-1", { received: false, reason: "NOT_RECEIVED" as never }, buyer)).rejects.toThrow(/7 дней/);
      await expect(service.confirmReceipt("order-1", { received: true }, buyer)).resolves.toBeDefined();
    });

    it("гонка при споре: updateMany вернул 0 — уведомления не создаются", async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.confirmReceipt("order-1", { received: false, reason: "OTHER" as never }, buyer)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
