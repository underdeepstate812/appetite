import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import { buildTheme, Theme } from "./tokens";
import { useThemeModeStore } from "../store/themeStore";

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const override = useThemeModeStore((state) => state.override);
  const hydrate = useThemeModeStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const resolvedMode = override === "system" ? (systemScheme === "dark" ? "dark" : "light") : override;
  const theme = useMemo(() => buildTheme(resolvedMode), [resolvedMode]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme должен использоваться внутри ThemeProvider");
  return theme;
}
