import { invoke } from "@tauri-apps/api/core";
import type { RunSummary, Thread, ThreadMessage } from "@/lib/types";

export type ThreadLoaderData = {
  thread: Thread;
  messages: ThreadMessage[];
  runs: RunSummary[];
};

export function getThread(threadId: string) {
  return invoke<ThreadLoaderData>("get_thread", { threadId });
}

export function threadLoader({
  params,
}: {
  params: Record<string, string | undefined>;
}) {
  if (!params.id) {
    throw new Response("Missing thread id", { status: 400 });
  }

  return getThread(params.id);
}

export function threadsLoader() {
  return invoke<Thread[]>("list_threads", {});
}
