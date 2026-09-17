import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// prisma.config.ts отключает автозагрузку .env — грузим корневой .env монорепо вручную.
// quiet: true — отключает рекламные "tip"-строки, которые dotenv v17+ печатает в
// консоль при каждой загрузке .env (см. load-env.ts).
config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "ts-node --transpile-only prisma/seed.ts",
  },
});
