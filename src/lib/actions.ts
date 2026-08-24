import { invoke } from "@tauri-apps/api/core";
import type { ThreadMessage } from "./types";

export function getThreadMessages(threadId: string) {
  return invoke<ThreadMessage[]>("get_thread_messages", {
    threadId,
  });
}
