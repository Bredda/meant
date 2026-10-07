import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";
import type { AppConfig } from "@/lib/types";
import { useConfigStore } from "@/stores/config-store";

export type BootstrapState =
  | { step: "init"; status: "loading"; progress: 0 }
  | { step: "vault"; status: "checking"; progress: 33 }
  | { step: "vault"; status: "error"; reason: string }
  | { step: "config"; status: "loading"; progress: 66 }
  | { step: "config"; status: "missing" }
  | { step: "config"; status: "error"; reason: string }
  | { step: "done"; status: "done"; progress: 100 };

export function useBootstrap() {
  const [state, setState] = useState<BootstrapState>({
    step: "init",
    status: "loading",
    progress: 0,
  });

  /**
   * Called by the setup form once preferences and at least one API key have
   * been persisted. Without it the "config missing" branch is terminal and the
   * user stays on the form forever.
   */
  const complete = useCallback((config: AppConfig) => {
    useConfigStore.getState().setConfig(config);
    setState({ step: "done", status: "done", progress: 100 });
  }, []);

  useEffect(() => {
    async function run() {
      setState({ step: "vault", status: "checking", progress: 33 });
      try {
        await invoke("check_vault");
      } catch (err) {
        // The vault is a hard requirement: without it no API key can be
        // stored, so there is nothing to fall back to.
        setState({ step: "vault", status: "error", reason: errorMessage(err) });
        return;
      }

      setState({ step: "config", status: "loading", progress: 66 });
      try {
        const config = await invoke<AppConfig | null>("load_config");
        if (config === null) {
          setState({ step: "config", status: "missing" });
        } else {
          useConfigStore.getState().setConfig(config);
          setState({ step: "done", status: "done", progress: 100 });
        }
      } catch (err) {
        setState({
          step: "config",
          status: "error",
          reason: errorMessage(err),
        });
      }
    }

    run();
  }, []);

  return { state, complete };
}
