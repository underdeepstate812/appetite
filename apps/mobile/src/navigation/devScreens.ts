import type React from "react";

/**
 * Экраны только для разработки. Подключаются условным require внутри `__DEV__`: в production-сборке Metro подставляет
 * `__DEV__ = false` и вырезает мёртвую ветку ещё до сбора зависимостей — модуль экрана и его тексты в приложение не попадают.
 * (Обычный `import` наверху файла оставил бы код экрана в бандле, даже если он нигде не показывается.)
 */
export const UiLabScreen: React.ComponentType | null = __DEV__ ? (require("../screens/lab/UiLabScreen") as { UiLabScreen: React.ComponentType }).UiLabScreen : null;
