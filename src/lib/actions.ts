import { ThreadMessage } from "./types";
import { invoke } from "@tauri-apps/api/core";

export async function getThreadMessages(threadId: string) {
  return invoke<ThreadMessage[]>("get_thread_messages", {
    threadId,
  });
}
