import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "apetite.themeModeOverride";

export type ThemeModeOverride = "system" | "light" | "dark";

interface ThemeModeState {
  override: ThemeModeOverride;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setOverride: (mode: ThemeModeOverride) => Promise<void>;
}

export const useThemeModeStore = create<ThemeModeState>()((set) => ({
  override: "system",
  isHydrated: false,

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === "system" || stored === "light" || stored === "dark") {
        set({ override: stored, isHydrated: true });
        return;
      }
    } catch {
      // AsyncStorage недоступен (напр. приватный режим) — просто остаёмся на "system".
    }
    set({ isHydrated: true });
  },

  setOverride: async (mode) => {
    set({ override: mode });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // best-effort — переживёт только текущую сессию, не критично
    }
  },
}));
