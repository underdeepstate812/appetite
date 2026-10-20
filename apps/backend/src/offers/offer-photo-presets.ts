import { OfferCategory } from "@prisma/client";

export interface OfferPhotoPreset {
  id: string;
  label: string;
  /** Относительный путь (раздаётся бэкендом) либо готовый адрес Unsplash. */
  url: string;
  category: OfferCategory;
}

const unsplash = (photoId: string) => `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=75`;
const { FOOD, BAKERY, FLOWERS, GROCERIES } = OfferCategory;

/**
 * Библиотека фото «по умолчанию» для заведений: можно выбрать готовое вместо собственной загрузки.
 * Файлы лежат в apps/backend/assets/offer-presets и раздаются по /presets/<файл>.
 */
export const OFFER_PHOTO_PRESETS: OfferPhotoPreset[] = [
  { id: "burger", label: "Бургер", url: "/presets/burger.jpg", category: FOOD },
  { id: "pizza", label: "Пицца", url: "/presets/pizza-pepperoni.jpg", category: FOOD },
  { id: "pasta", label: "Паста", url: "/presets/carbonara.jpg", category: FOOD },
  { id: "caesar", label: "Салат Цезарь", url: "/presets/caesar-salad.jpg", category: FOOD },
  { id: "fries", label: "Картофель фри", url: "/presets/fries.jpg", category: FOOD },
  { id: "poke", label: "Поке с лососем", url: "/presets/poke-salmon-mango.jpg", category: FOOD },
  { id: "sushi", label: "Суши", url: "/presets/sushi-philadelphia.jpg", category: FOOD },
  { id: "steak", label: "Стейк", url: "/presets/steak.jpg", category: FOOD },
  { id: "shawarma", label: "Шаурма", url: "/presets/shawarma.jpg", category: FOOD },
  { id: "tom-yum", label: "Том Ям", url: "/presets/tom-yum.jpg", category: FOOD },
  { id: "pad-thai", label: "Лапша Пад Тай", url: "/presets/pad-thai.jpg", category: FOOD },
  { id: "cappuccino", label: "Капучино", url: "/presets/cappuccino.jpg", category: FOOD },
  { id: "coffee-shake", label: "Кофе и коктейль", url: "/presets/cappuccino-shake.jpg", category: FOOD },
  { id: "bread", label: "Хлеб и выпечка", url: unsplash("photo-1509440159596-0249088772ff"), category: BAKERY },
  { id: "desserts", label: "Десерты", url: unsplash("photo-1488477181946-6428a0291777"), category: BAKERY },
  { id: "flowers", label: "Букет цветов", url: unsplash("photo-1487070183336-b863922373d4"), category: FLOWERS },
  { id: "groceries", label: "Овощи и продукты", url: unsplash("photo-1542838132-92c53300491e"), category: GROCERIES },
];
