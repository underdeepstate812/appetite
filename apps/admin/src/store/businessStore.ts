import { create } from "zustand";
import type { Business } from "@apetite/shared";
import { businessesApi, type UpdateBusinessRequest } from "../api/businesses";

interface BusinessState {
  business: Business | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  update: (input: UpdateBusinessRequest) => Promise<void>;
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

  reset: () => set({ business: null, loading: false, error: null }),
}));
