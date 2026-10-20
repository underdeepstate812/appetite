import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/app.css";
import "./styles/dark.css";
import { themeActions } from "./store/theme";

themeActions.init();

/**
 * Демо-режим (VITE_DEMO=1, сборка для GitHub Pages): запросы к API обслуживает встроенный backend из @apetite/demo, сервер не нужен.
 * В обычной сборке этот блок вырезается целиком (константа на этапе сборки), и демо-код в бандл не попадает.
 */
async function start() {
  if (import.meta.env.VITE_DEMO === "1") {
    const { installDemoApi } = await import("@apetite/demo");
    installDemoApi({
      apiBase: import.meta.env.VITE_API_BASE_URL,
      assetBase: new URL(`${import.meta.env.BASE_URL}demo/`, window.location.href).href,
      banner: {
        app: "сайт покупателя",
        lines: ["Это демо: данные примерные, сервер не нужен — всё хранится в вашем браузере.", "Вход: <b>user@apetite.ru</b> / <b>password123</b> (или зарегистрируйтесь).", "Кабинет бизнеса — в соседнем разделе демо."],
      },
    });
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void start();
