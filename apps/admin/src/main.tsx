import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

/** Демо-режим для GitHub Pages: см. apps/web/src/main.tsx. */
async function start() {
  if (import.meta.env.VITE_DEMO === "1") {
    const { installDemoApi } = await import("@apetite/demo");
    installDemoApi({
      apiBase: import.meta.env.VITE_API_BASE_URL,
      assetBase: new URL(`${import.meta.env.BASE_URL}demo/`, window.location.href).href,
      banner: {
        app: "кабинет бизнеса",
        lines: ["Это демо: данные примерные, сервер не нужен — всё хранится в вашем браузере.", "Вход: <b>cafe.pushkin@apetite.ru</b> / <b>password123</b>.", "Заказ, оформленный на сайте покупателя, появится здесь."],
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
