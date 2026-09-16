import path from "node:path";
import { config } from "dotenv";

// Docker передаёт переменные через docker-compose `environment:`, но при локальном
// запуске (tsx/ts-node вне контейнера) их надо подхватить из корневого .env монорепо.
config({ path: path.resolve(__dirname, "../../../.env") });
