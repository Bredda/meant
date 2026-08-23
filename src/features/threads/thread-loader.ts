import { Thread, ThreadMessage } from "@/lib/types";
import { invoke } from "@tauri-apps/api/core";

export type ThreadLoaderData = {
  thread: Thread;
  messages: ThreadMessage[];
};

export async function threadLoader({
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

export async function threadsLoader() {
  return invoke<Thread[]>("list_threads", {});
}
