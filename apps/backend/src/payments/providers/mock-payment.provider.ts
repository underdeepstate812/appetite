import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { ChargeInput, ChargeResult, PaymentProvider } from "../payment-provider.interface";

/** Мок-провайдер для dev/беты: подтверждает оплату синхронно и всегда успешно. */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async charge(_input: ChargeInput): Promise<ChargeResult> {
    return {
      externalId: `mock_${randomUUID()}`,
      status: PaymentStatus.SUCCEEDED,
    };
  }
}
