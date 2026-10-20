import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allShowcaseItems, discountFor, placeAround } from "./showcase";
import { foodInfoData } from "./food-info-seed";

/**
 * Выгружает те же 59 предложений витрины (лента + городская), что и сид, в JSON для автономного демо (packages/demo): без
 * backend и базы сайт, кабинет и мобильная версия на GitHub Pages показывают ровно эти данные.
 * Запуск: pnpm --filter @apetite/backend demo:export-seed
 */
const items = allShowcaseItems().map((item, index) => {
  const place = item.place ?? { address: `Санкт-Петербург, ${item.shop}`, ...placeAround(item.distanceKm ?? 1, index) };
  const { baseDiscountPercent } = discountFor(item);
  const ref = new Date(0);
  const food = foodInfoData(item.title, item.category, ref);
  return {
    shop: item.shop,
    title: item.title,
    description: item.description ?? null,
    category: item.category,
    originalPriceRub: item.originalPriceRub,
    baseDiscountPercent,
    hoursToEnd: item.hoursToEnd,
    quantityTotal: item.quantityTotal,
    weightKg: item.weightKg,
    image: item.image ?? null,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    ingredients: food.ingredients ?? null,
    allergens: food.allergens ?? [],
    allergensDeclared: food.allergensDeclared ?? false,
    /** Срок годности — часов после конца самовывоза. */
    shelfHours: food.bestBefore ? Math.round((food.bestBefore.getTime() - ref.getTime()) / 3_600_000) : null,
  };
});

const out = join(__dirname, "..", "..", "..", "packages", "demo", "src", "seed-data.ts");
mkdirSync(join(out, ".."), { recursive: true });
writeFileSync(
  out,
  `// Сгенерировано: pnpm --filter @apetite/backend demo:export-seed (не править руками).\nimport type { SeedItem } from "./types";\n\nexport const SEED_ITEMS: SeedItem[] = ${JSON.stringify(items, null, 2)};\n`
);
console.log(`Выгружено ${items.length} предложений → ${out}`);
