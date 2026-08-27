// stores/configStore.ts

import { create } from "zustand";
import type { Theme } from "@/components/theme-provider";
import type { AppConfig } from "@/lib/types";

interface ConfigState {
  config: AppConfig | null;
  setConfig: (config: AppConfig) => void;
  setStatus: (status: ConfigState["status"]) => void;
  setTheme: (theme: Theme) => void;
  status: "loading" | "ready" | "missing" | "error";
  updateConfig: (config: Partial<AppConfig>) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  status: "loading",
  setConfig: (config) => set({ config, status: "ready" }),
  setStatus: (status) => set({ status }),
  updateConfig: (config: Partial<AppConfig>) =>
    set((state) => ({
      config: { ...state.config, ...config } as AppConfig,
    })),
  setTheme(theme) {
    this.updateConfig({ theme });
  },
}));
