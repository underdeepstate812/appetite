import { DarkTheme, DefaultTheme, Theme as NavigationTheme } from "@react-navigation/native";
import type { Theme } from "./tokens";

/** React Navigation темизирует хедеры/таб-бар сам через этот объект (colors.card/text и т.д.). */
export function buildNavigationTheme(theme: Theme): NavigationTheme {
  const base = theme.mode === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.mode === "dark",
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.background,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}
