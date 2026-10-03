import path from "node:path";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { syncShowcase } from "./showcase";

/**
 * Обновляет витрину (19 офферов с ленты на главной) БЕЗ очистки БД: пользователи, сессии и заказы остаются.
 * Окна самовывоза живут часы — запускайте, когда лента опустела: pnpm --filter @apetite/backend prisma:seed:showcase
 */
// Вне `prisma db seed` переменные окружения никто не загружает — берём корневой .env монорепо (как prisma.config.ts).
config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const count = await syncShowcase(prisma, passwordHash);
  console.log(`Витрина обновлена: ${count} офферов.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
