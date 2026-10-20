import { BadRequestException } from "@nestjs/common";
import { OfferCategory } from "@apetite/shared";
import { assertFoodInfo, FoodInfoInput } from "./food-info";

const pickupEnd = new Date("2026-10-05T18:00:00Z");
const complete = (over: Partial<FoodInfoInput> = {}): FoodInfoInput => ({
  category: OfferCategory.FOOD,
  ingredients: "Лаваш, курица, огурцы, соус",
  allergens: ["gluten", "milk"],
  bestBefore: new Date("2026-10-05T22:00:00Z"),
  pickupEnd,
  ...over,
});

describe("assertFoodInfo (strict: создание оффера и правка этих полей)", () => {
  it("принимает полный набор", () => {
    expect(() => assertFoodInfo(complete(), true)).not.toThrow();
  });

  it("«аллергенов нет» — это пустой список, и он допустим; отсутствие списка — нет", () => {
    expect(() => assertFoodInfo(complete({ allergens: [] }), true)).not.toThrow();
    expect(() => assertFoodInfo(complete({ allergens: undefined }), true)).toThrow(/аллерген/i);
    expect(() => assertFoodInfo(complete({ allergens: null }), true)).toThrow(BadRequestException);
  });

  it.each([OfferCategory.FOOD, OfferCategory.BAKERY, OfferCategory.GROCERIES])("для %s состав обязателен", (category) => {
    expect(() => assertFoodInfo(complete({ category, ingredients: "" }), true)).toThrow(/состав/i);
    expect(() => assertFoodInfo(complete({ category, ingredients: "  ab " }), true)).toThrow(/состав/i);
  });

  it("срок годности обязателен", () => {
    expect(() => assertFoodInfo(complete({ bestBefore: null }), true)).toThrow(/срок годности/i);
  });

  it("для цветов ничего из этого не обязательно", () => {
    expect(() => assertFoodInfo({ category: OfferCategory.FLOWERS, pickupEnd }, true)).not.toThrow();
  });

  it("срок годности не может кончаться раньше конца самовывоза", () => {
    expect(() => assertFoodInfo(complete({ bestBefore: new Date("2026-10-05T17:59:00Z") }), true)).toThrow(/раньше конца/);
    expect(() => assertFoodInfo(complete({ bestBefore: pickupEnd }), true)).not.toThrow();
  });

  it("отвергает неизвестные коды аллергенов и слишком длинный состав", () => {
    expect(() => assertFoodInfo(complete({ allergens: ["gluten", "dragonfruit"] }), true)).toThrow(/dragonfruit/);
    expect(() => assertFoodInfo(complete({ ingredients: "я".repeat(1001) }), true)).toThrow(/длинный/);
  });
});

describe("assertFoodInfo (не strict: старые офферы без состава)", () => {
  it("не требует состава у старого оффера — его можно снять с продажи", () => {
    expect(() => assertFoodInfo({ category: OfferCategory.FOOD, pickupEnd }, false)).not.toThrow();
  });

  it("но не даёт сломать согласованность: срок годности раньше конца выдачи — всё равно ошибка", () => {
    expect(() => assertFoodInfo({ category: OfferCategory.FOOD, pickupEnd, bestBefore: new Date("2026-10-05T10:00:00Z") }, false)).toThrow(/раньше конца/);
  });
});
