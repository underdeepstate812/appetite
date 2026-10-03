import { registerDecorator, ValidationOptions } from "class-validator";
import { isAllowedOfferImageUrl } from "../offer-photo";

/**
 * Разрешает в imageUrl только то, что выдаёт сам сервис: загруженное фото (/uploads/offers/…), фото из библиотеки
 * (/presets/…) или Unsplash. Раньше принималась любая строка — через API можно было подставить чужой трекинг-
 * пиксель или внутренний адрес. null/undefined пропускает @IsOptional() — так фото снимают.
 */
export function IsOfferImageUrl(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isOfferImageUrl",
      target: object.constructor,
      propertyName,
      options: { message: "Недопустимый адрес фото: загрузите файл или выберите фото из библиотеки", ...options },
      validator: {
        validate: (value: unknown) => typeof value === "string" && isAllowedOfferImageUrl(value),
      },
    });
  };
}
