import { Croissant, Flower2, ShoppingBasket, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { OfferCategory } from "@apetite/shared";

export const CATEGORY_META: Record<OfferCategory, { label: string; icon: LucideIcon }> = {
  [OfferCategory.FOOD]: { label: "Еда", icon: UtensilsCrossed },
  [OfferCategory.BAKERY]: { label: "Выпечка", icon: Croissant },
  [OfferCategory.FLOWERS]: { label: "Цветы", icon: Flower2 },
  [OfferCategory.GROCERIES]: { label: "Продукты", icon: ShoppingBasket },
};

export const CATEGORY_FILTERS: { id: OfferCategory | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  ...Object.values(OfferCategory).map((id) => ({ id, label: CATEGORY_META[id].label })),
];
