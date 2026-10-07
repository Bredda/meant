import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { useLocation, useNavigate, useRevalidator } from "react-router";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import type { Thread } from "@/lib/types";

/**
 * Renaming and deleting threads from the sidebar. Rust owns the rules (title
 * validation, refusing to delete a thread that is running); this hook only
 * refreshes the route data afterwards and reports a rejection.
 */
export function useThreadActions() {
  const { revalidate } = useRevalidator();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const renameThread = useCallback(
    async (threadId: string, title: string) => {
      try {
        await invoke<Thread>("rename_thread", {
          request: { threadId, title },
        });
        await revalidate();
        return true;
      } catch (error) {
        toast.error("Could not rename the thread", {
          description: errorMessage(error),
        });
        return false;
      }
    },
    [revalidate]
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      try {
        await invoke<void>("delete_thread", { threadId });
      } catch (error) {
        toast.error("Could not delete the thread", {
          description: errorMessage(error),
        });
        return;
      }

      // Leave the deleted thread's page before its loader runs again.
      if (pathname === `/threads/${threadId}`) {
        navigate("/threads", { replace: true });
      }
      await revalidate();
    },
    [navigate, pathname, revalidate]
  );

  return { renameThread, deleteThread };
}
