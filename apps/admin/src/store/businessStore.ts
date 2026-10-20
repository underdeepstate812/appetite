import { create } from "zustand";
import type { Business } from "@apetite/shared";
import type { WorkingHours } from "@apetite/shared";
import { businessesApi, type UpdateBusinessRequest, type WorkingHoursConflicts } from "../api/businesses";

interface BusinessState {
  business: Business | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  update: (input: UpdateBusinessRequest) => Promise<void>;
  /** Сохраняет часы работы и возвращает, что из уже выложенного в них не влезает. */
  setWorkingHours: (hours: WorkingHours | null) => Promise<WorkingHoursConflicts>;
  reset: () => void;
}

// Один владелец — одно заведение в бете (ШАГ 0): берём первое из /businesses/mine.
export const useBusinessStore = create<BusinessState>()((set, get) => ({
  business: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const businesses = await businessesApi.mine();
      set({ business: businesses[0] ?? null, loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "Не удалось загрузить заведение" });
    }
  },

  update: async (input) => {
    const current = get().business;
    if (!current) return;
    const updated = await businessesApi.update(current.id, input);
    set({ business: updated });
  },

  setWorkingHours: async (hours) => {
    const current = get().business;
    if (!current) return { offers: [], schedules: [] };
    const result = await businessesApi.setWorkingHours(current.id, hours);
    set({ business: result.business });
    return result.conflicts;
  },

  reset: () => set({ business: null, loading: false, error: null }),
}));
