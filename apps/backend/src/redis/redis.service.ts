import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * Первое реальное использование Redis в проекте (был поднят в Docker Compose с ШАГ 2,
 * но backend его не трогал — см. docs/BACKLOG.md). Сейчас единственный потребитель —
 * OTP-коды для верификации телефона при регистрации (auth.service.ts): TTL-ключи —
 * ровно то, для чего Redis тут и был, без изобретения собственной "очистки по времени".
 */
@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super(config.get<string>("REDIS_URL", "redis://localhost:6379"), { lazyConnect: true });
  }

  async onModuleInit() {
    await this.connect();
  }

  onModuleDestroy() {
    this.disconnect();
  }
}
