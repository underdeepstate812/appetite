import UtensilsCrossed from "lucide-react-native/icons/utensils-crossed";
import Croissant from "lucide-react-native/icons/croissant";
import Flower2 from "lucide-react-native/icons/flower-2";
import ShoppingBasket from "lucide-react-native/icons/shopping-basket";
import type { OfferCategory } from "@apetite/shared";

export const CATEGORY_ICON: Record<OfferCategory, typeof UtensilsCrossed> = {
  FOOD: UtensilsCrossed,
  BAKERY: Croissant,
  FLOWERS: Flower2,
  GROCERIES: ShoppingBasket,
} as Record<OfferCategory, typeof UtensilsCrossed>;
