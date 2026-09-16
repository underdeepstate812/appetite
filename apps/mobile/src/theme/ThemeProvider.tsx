import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { buildTheme, Theme } from "./tokens";

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const theme = useMemo(() => buildTheme(colorScheme === "dark" ? "dark" : "light"), [colorScheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme должен использоваться внутри ThemeProvider");
  return theme;
}
