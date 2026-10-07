import { useEffect } from "react";
import { useLoaderData } from "react-router";
import type { ThreadLoaderData } from "@/features/threads/thread-loader";
import { ThreadWindow } from "../../features/threads/components/thread-window";
import { useThread } from "../../features/threads/thread-context";

export function ThreadPage() {
  const { thread, messages: loadedMessages } =
    useLoaderData<ThreadLoaderData>();

  const { messages, isBusy, hydrate, sendMessage } = useThread();

  useEffect(() => {
    hydrate(thread, loadedMessages);
  }, [thread, hydrate, loadedMessages]);
  return (
    <div className="h-full min-h-0">
      <ThreadWindow
        isBusy={isBusy}
        messages={messages}
        onSubmit={sendMessage}
        thread={thread}
      />
    </div>
  );
}

// Necessary for react router to lazy load.
export const Component = ThreadPage;
