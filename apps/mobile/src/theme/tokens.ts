const palette = {
  primary: "#FF6B4A",
  primaryDark: "#FF8566",
  // Мягкая заливка под акцентом (бейджи/карточки статуса) — тон, не полноцветная заливка.
  primarySoft: "#FFE8E1",
  primarySoftDark: "#3A241D",
  secondary: "#2E7D5B",
  secondaryDark: "#4CAF7D",
  background: "#FFFFFF",
  backgroundDark: "#121212",
  surface: "#F7F5F3",
  surfaceDark: "#1E1E1E",
  // На ступень выше surface — для вложенных карточек/выделенных блоков.
  surfaceElevated: "#FFFFFF",
  surfaceElevatedDark: "#262626",
  text: "#1A1A1A",
  textDark: "#F2F2F2",
  textMuted: "#6B6B6B",
  textMutedDark: "#A0A0A0",
  border: "#E5E1DC",
  borderDark: "#2E2E2E",
  danger: "#D64545",
  dangerDark: "#E86A6A",
  dangerSoft: "#FBE6E6",
  dangerSoftDark: "#3A2323",
  success: "#2E7D5B",
  successDark: "#4CAF7D",
  successSoft: "#E3F3EB",
  successSoftDark: "#1E3329",
  warning: "#C98A12",
  warningDark: "#E0A61A",
  warningSoft: "#FBF0DA",
  warningSoftDark: "#3A2F16",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radii = { sm: 6, md: 12, lg: 20, full: 999 } as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const },
  h2: { fontSize: 22, fontWeight: "700" as const },
  h3: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyBold: { fontSize: 15, fontWeight: "600" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
} as const;

export type ThemeMode = "light" | "dark";

export interface Theme {
  mode: ThemeMode;
  colors: {
    primary: string;
    primarySoft: string;
    secondary: string;
    background: string;
    surface: string;
    surfaceElevated: string;
    text: string;
    textMuted: string;
    border: string;
    danger: string;
    dangerSoft: string;
    success: string;
    successSoft: string;
    warning: string;
    warningSoft: string;
    onPrimary: string;
  };
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
}

export function buildTheme(mode: ThemeMode): Theme {
  const isDark = mode === "dark";
  return {
    mode,
    colors: {
      primary: isDark ? palette.primaryDark : palette.primary,
      primarySoft: isDark ? palette.primarySoftDark : palette.primarySoft,
      secondary: isDark ? palette.secondaryDark : palette.secondary,
      background: isDark ? palette.backgroundDark : palette.background,
      surface: isDark ? palette.surfaceDark : palette.surface,
      surfaceElevated: isDark ? palette.surfaceElevatedDark : palette.surfaceElevated,
      text: isDark ? palette.textDark : palette.text,
      textMuted: isDark ? palette.textMutedDark : palette.textMuted,
      border: isDark ? palette.borderDark : palette.border,
      danger: isDark ? palette.dangerDark : palette.danger,
      dangerSoft: isDark ? palette.dangerSoftDark : palette.dangerSoft,
      success: isDark ? palette.successDark : palette.success,
      successSoft: isDark ? palette.successSoftDark : palette.successSoft,
      warning: isDark ? palette.warningDark : palette.warning,
      warningSoft: isDark ? palette.warningSoftDark : palette.warningSoft,
      onPrimary: "#FFFFFF",
    },
    spacing,
    radii,
    typography,
  };
}
