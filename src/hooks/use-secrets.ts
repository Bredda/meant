import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import type { ProviderId } from "@/config/providers";
import { errorMessage } from "@/lib/errors";

export type SecretStatus = {
  provider: ProviderId;
  isSet: boolean;
};

/**
 * Write-only access to the OS vault.
 *
 * There is no read path on purpose: the backend exposes presence only, so a
 * key never reaches the renderer once it has been stored.
 */
export function useSecrets() {
  const [statuses, setStatuses] = useState<SecretStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatuses(await invoke<SecretStatus[]>("list_secrets"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSecret = useCallback(
    async (provider: ProviderId, value: string) => {
      await invoke<void>("set_secret", { request: { provider, value } });
      await refresh();
    },
    [refresh]
  );

  const deleteSecret = useCallback(
    async (provider: ProviderId) => {
      await invoke<void>("delete_secret", { request: { provider } });
      await refresh();
    },
    [refresh]
  );

  return { statuses, error, refresh, setSecret, deleteSecret };
}

/** Bare command wrapper for callers that own their own state, e.g. setup. */
export async function storeSecret(provider: ProviderId, value: string) {
  await invoke<void>("set_secret", { request: { provider, value } });
}
