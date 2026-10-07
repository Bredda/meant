import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";
import type { Thread } from "@/lib/types";

/** Emitted by Rust (`TITLE_UPDATED_EVENT`) when a generated title is stored. */
const THREAD_TITLE_UPDATED = "thread-title-updated";

/**
 * Refreshes the route data when a thread gets its generated title: it arrives
 * seconds after the run that caused it, on no `invoke` of the UI's.
 */
export function useThreadTitleUpdates() {
  const { revalidate } = useRevalidator();
  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;

  useEffect(() => {
    const unlisten = listen<Thread>(THREAD_TITLE_UPDATED, () => {
      revalidateRef.current();
    });

    return () => {
      // `listen` rejects outside the app (`pnpm dev` in a browser).
      unlisten.then((stop) => stop()).catch(() => undefined);
    };
  }, []);
}
