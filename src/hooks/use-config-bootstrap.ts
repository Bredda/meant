import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import type { AppConfig } from "@/lib/types";
import { useConfigStore } from "@/stores/config-store";

export function useConfigBootstrap() {
  useEffect(() => {
    useConfigStore.getState().setStatus("loading");
    const unlistenLoaded = listen<AppConfig>("config-loaded", (e) => {
      useConfigStore.getState().setConfig(e.payload);
    });
    const unlistenMissing = listen("config-missing", () => {
      useConfigStore.getState().setStatus("missing");
    });
    const unlistenError = listen<string>("config-error", () => {
      useConfigStore.getState().setStatus("error");
      console.log("Config file load error, must retake initial setting");
    });

    return () => {
      unlistenLoaded.then((f) => f());
      unlistenMissing.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);
}
