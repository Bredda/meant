import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import type { AppConfig } from "@/lib/types";
import { useConfigStore } from "@/stores/config-store";

export function useUpdateConfig() {
  const setConfig = useConfigStore((state) => state.setConfig);

  return useCallback(
    async (config: Partial<AppConfig>) => {
      const updated = await invoke<AppConfig>("update_config", {
        request: { ...config },
      });
      setConfig(updated);
      return updated;
    },
    [setConfig]
  );
}
