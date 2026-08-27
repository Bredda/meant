import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "@/lib/types";
import { useConfigStore } from "@/stores/config-store";

export function useUpdateConfig() {
  const setConfig = useConfigStore((state) => state.setConfig);

  const updateConfig = async (config: Partial<AppConfig>) => {
    console.log(config);
    const _result = await invoke<AppConfig>("update_config", {
      request: { ...config },
    });
    console.debug("updateConfig result", _result);
    setConfig(_result);
  };

  return updateConfig;
}
