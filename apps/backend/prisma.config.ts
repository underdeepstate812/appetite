import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// prisma.config.ts отключает автозагрузку .env — грузим корневой .env монорепо вручную.
config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "ts-node --transpile-only prisma/seed.ts",
  },
});
