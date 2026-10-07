import { create } from "zustand";
import type { AppConfig } from "@/lib/types";

interface ConfigState {
  config: AppConfig | null;
  setConfig: (config: AppConfig) => void;
}

/**
 * Holds the non-secret user config once bootstrap has loaded it. Writes go
 * through `useUpdateConfig`, which persists to config.toml and then feeds the
 * backend's response back in here — the store is never the source of truth.
 */
export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  setConfig: (config) => set({ config }),
}));
