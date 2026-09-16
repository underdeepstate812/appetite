import { Injectable, Logger } from "@nestjs/common";
import { PushMessage, PushProvider } from "../push-provider.interface";

/** Мок для dev/беты: вместо реальной отправки в Expo Push API — структурированный лог. */
@Injectable()
export class MockPushProvider implements PushProvider {
  readonly name = "mock";
  private readonly logger = new Logger(MockPushProvider.name);

  async send(token: string, message: PushMessage): Promise<void> {
    this.logger.log(`mock push -> ${token}: "${message.title}" — ${message.body}`);
  }
}
