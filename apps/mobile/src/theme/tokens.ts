import type { TextStyle } from "react-native";

/**
 * Палитра "Жар": время = температура. Тёмная тема — глубокий бирюзово-чёрный (не нейтральный
 * #121212), светлая — тёплая бумага (как на сайте). Единственный "живой" акцент — ember:
 * шкала heat от мяты через бирюзу и янтарь к красному, красный только для срочности.
 * Пары текст/фон посчитаны по WCAG (≥4.5:1 для основного и приглушённого текста).
 */
const palette = {
  primary: "#0F766E",
  primaryDark: "#2DD4BF",
  // Мягкая заливка под акцентом (бейджи/карточки статуса) — тон, не полноцветная заливка.
  primarySoft: "#D5F5EF",
  primarySoftDark: "#12332F",
  secondary: "#1F7A55",
  secondaryDark: "#4CC38A",
  background: "#FFFCF6",
  backgroundDark: "#0B1110",
  surface: "#F6F1E8",
  surfaceDark: "#121A19",
  // На ступень выше surface — для вложенных карточек/выделенных блоков.
  surfaceElevated: "#FFFFFF",
  surfaceElevatedDark: "#18221F",
  text: "#16201E",
  textDark: "#EDF5F3",
  textMuted: "#5B6B67",
  textMutedDark: "#93A7A2",
  border: "#E7DFD1",
  borderDark: "#24302D",
  danger: "#B42318",
  dangerDark: "#F0665A",
  dangerSoft: "#FBE3DE",
  dangerSoftDark: "#3A1F1B",
  success: "#1A6F4D",
  successDark: "#4CC38A",
  successSoft: "#DDF1E6",
  successSoftDark: "#173226",
  warning: "#96590A",
  warningDark: "#F5B83D",
  warningSoft: "#FBEBCB",
  warningSoftDark: "#362A10",
  ember: "#B5380A",
  emberDark: "#FF8A3D",
  emberSoft: "#FDE6D6",
  emberSoftDark: "#3A2114",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radii = { sm: 8, md: 14, lg: 18, xl: 28, full: 999 } as const;

export type ThemeMode = "light" | "dark";

/**
 * Display-гарнитура Unbounded (как на сайте) — только для цифр и коротких заголовков; текст
 * остаётся системным. Загружаем ОДИН вес (700): это ~770 КБ экономии против трёх весов, а
 * иерархию дают размер и цвет. medium/bold/heavy — совместимые алиасы одного начертания.
 */
export interface DisplayFonts {
  medium: TextStyle;
  bold: TextStyle;
  heavy: TextStyle;
}

// Кастомная гарнитура на native задаётся именем файла-веса, а fontWeight должен быть
// "normal": иначе Android откатывается на системный шрифт, а web дорисовывает faux-bold.
const UNBOUNDED_BOLD: TextStyle = { fontFamily: "Unbounded_700Bold", fontWeight: "normal" };
const UNBOUNDED: DisplayFonts = { medium: UNBOUNDED_BOLD, bold: UNBOUNDED_BOLD, heavy: UNBOUNDED_BOLD };

// Пока шрифт не загрузился (или не загрузился совсем) — обычные системные веса.
const SYSTEM_DISPLAY: DisplayFonts = {
  medium: { fontWeight: "600" },
  bold: { fontWeight: "700" },
  heavy: { fontWeight: "800" },
};

function buildTypography(fonts: DisplayFonts) {
  return {
    h1: { fontSize: 22, lineHeight: 28, letterSpacing: -0.3, ...fonts.bold },
    h2: { fontSize: 17, lineHeight: 23, letterSpacing: -0.2, ...fonts.bold },
    h3: { fontSize: 15, lineHeight: 21, letterSpacing: -0.1, ...fonts.medium },
    body: { fontSize: 15, fontWeight: "400" as const },
    bodyBold: { fontSize: 15, fontWeight: "600" as const },
    caption: { fontSize: 13, fontWeight: "400" as const },
  };
}

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
    /** Живой акцент: горячая точка на предмете, где время или внимание "горит". */
    ember: string;
    emberSoft: string;
    onPrimary: string;
  };
  fonts: DisplayFonts;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: ReturnType<typeof buildTypography>;
}

export function buildTheme(mode: ThemeMode, displayFontLoaded = false): Theme {
  const isDark = mode === "dark";
  const fonts = displayFontLoaded ? UNBOUNDED : SYSTEM_DISPLAY;
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
      ember: isDark ? palette.emberDark : palette.ember,
      emberSoft: isDark ? palette.emberSoftDark : palette.emberSoft,
      onPrimary: isDark ? "#04211D" : "#FFFFFF",
    },
    fonts,
    spacing,
    radii,
    typography: buildTypography(fonts),
  };
}
