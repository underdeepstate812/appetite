import { useSyncExternalStore } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const KEY = "apetite.web.theme";

function readMode(): ThemeMode {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
}

let mode: ThemeMode = readMode();
const listeners = new Set<() => void>();

/** Ставит тему на <html>: CSS переопределяет переменные по [data-theme="dark"], а colorScheme красит полосы прокрутки и поля форм. */
function apply() {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export const themeActions = {
  /** Один раз при старте (и в тестах): применить сохранённый выбор и следить за системной темой, пока выбрана «Системная». */
  init() {
    mode = readMode();
    apply();
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (mode === "system") {
          apply();
          listeners.forEach((listener) => listener());
        }
      });
    }
  },
  set(next: ThemeMode) {
    mode = next;
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // хранилище недоступно — выбор живёт до перезагрузки
    }
    apply();
    listeners.forEach((listener) => listener());
  },
};

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => mode
  );
}
