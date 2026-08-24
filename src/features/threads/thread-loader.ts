import { invoke } from "@tauri-apps/api/core";
import type { Thread, ThreadMessage } from "@/lib/types";

export type ThreadLoaderData = {
  thread: Thread;
  messages: ThreadMessage[];
};

export function threadLoader({
  params,
}: {
  params: Record<string, string | undefined>;
}) {
  if (!params.id) {
    throw new Response("Missing thread id", { status: 400 });
  }

  return invoke<ThreadLoaderData>("get_thread", {
    threadId: params.id,
  });
}

export function threadsLoader() {
  return invoke<Thread[]>("list_threads", {});
}
