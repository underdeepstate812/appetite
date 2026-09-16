import { Inject, Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ChargeInput, ChargeResult, PAYMENT_PROVIDER, PaymentProvider } from "./payment-provider.interface";

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly prisma: PrismaService
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  charge(input: ChargeInput): Promise<ChargeResult> {
    return this.provider.charge(input);
  }

  /** Вызывается вебхуком провайдера — идемпотентно обновляет статус платежа по externalId. */
  applyWebhookUpdate(externalId: string, status: PaymentStatus) {
    return this.prisma.payment.update({
      where: { externalId },
      data: { status },
    });
  }
}
