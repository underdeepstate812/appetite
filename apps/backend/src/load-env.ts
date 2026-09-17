import path from "node:path";
import { config } from "dotenv";

// Docker передаёт переменные через docker-compose `environment:`, но при локальном
// запуске (tsx/ts-node вне контейнера) их надо подхватить из корневого .env монорепо.
// quiet: true — dotenv с v17 сам печатает в консоль рекламные "tip"-строки
// (например, на сторонние продукты автора пакета) при каждой загрузке .env;
// это официальный флаг именно для отключения этого вывода, не наша самодеятельность.
config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });
