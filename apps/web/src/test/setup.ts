import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Без test.globals:true в vitest.config.ts @testing-library/react не находит
// глобальный afterEach сама и не регистрирует автоочистку — без этого разные
// render() в одном файле накапливались бы в DOM, включая портал .mobile-menu.
afterEach(() => {
  cleanup();
});
