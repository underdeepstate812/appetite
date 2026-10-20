import type { ThemeMode } from "./tokens";

/**
 * «Стекло и неон» в палитре Ember: полупрозрачная заливка, тонкая кромка и мягкое свечение того же тона.
 * Свечение — это тот же мятный (primary) и жаркий (ember) цвет приложения, а не новый акцент: стекло лишь
 * добавляет глубину поверх уже знакомой гаммы. В светлой теме «неон» приглушён до тёплой тени —
 * яркое свечение на бумажном фоне выглядит грязью и режет контраст текста.
 */
export type GlassTone = "mint" | "ember" | "plain";

export interface GlassTokens {
  fill: string;
  border: string;
  /** Блик по верхней кромке — имитация света на стекле. */
  sheen: string;
  /** Свечение + подъём над фоном (CSS-подобная строка boxShadow). */
  shadow: string;
  /** Цвет иконок/заголовков секции внутри карточки. */
  accent: string;
}

const TONES: Record<ThemeMode, Record<GlassTone, GlassTokens>> = {
  dark: {
    mint: {
      fill: "rgba(24, 34, 31, 0.62)",
      border: "rgba(94, 234, 212, 0.30)",
      sheen: "rgba(184, 251, 239, 0.10)",
      shadow: "0 0 0 1px rgba(45, 212, 191, 0.06), 0 10px 34px rgba(45, 212, 191, 0.16)",
      accent: "#5EEAD4",
    },
    ember: {
      fill: "rgba(36, 24, 18, 0.62)",
      border: "rgba(255, 138, 61, 0.34)",
      sheen: "rgba(255, 200, 150, 0.09)",
      shadow: "0 0 0 1px rgba(255, 138, 61, 0.06), 0 10px 34px rgba(255, 138, 61, 0.15)",
      accent: "#FF8A3D",
    },
    plain: {
      fill: "rgba(24, 34, 31, 0.55)",
      border: "rgba(237, 245, 243, 0.12)",
      sheen: "rgba(237, 245, 243, 0.06)",
      shadow: "0 8px 26px rgba(0, 0, 0, 0.35)",
      accent: "#93A7A2",
    },
  },
  light: {
    mint: {
      fill: "rgba(255, 255, 255, 0.70)",
      border: "rgba(15, 118, 110, 0.24)",
      sheen: "rgba(255, 255, 255, 0.90)",
      shadow: "0 8px 28px rgba(15, 118, 110, 0.13)",
      accent: "#0F766E",
    },
    ember: {
      fill: "rgba(255, 249, 243, 0.74)",
      border: "rgba(181, 56, 10, 0.26)",
      sheen: "rgba(255, 255, 255, 0.90)",
      shadow: "0 8px 28px rgba(181, 56, 10, 0.12)",
      accent: "#B5380A",
    },
    plain: {
      fill: "rgba(255, 255, 255, 0.66)",
      border: "rgba(22, 32, 30, 0.10)",
      sheen: "rgba(255, 255, 255, 0.90)",
      shadow: "0 6px 20px rgba(22, 32, 30, 0.08)",
      accent: "#5B6B67",
    },
  },
};

export function glassTokens(mode: ThemeMode, tone: GlassTone = "mint"): GlassTokens {
  return TONES[mode][tone];
}
