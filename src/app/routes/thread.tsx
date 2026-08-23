import { useEffect } from "react";
import { useLoaderData } from "react-router";
import { ThreadWindow } from "../../features/threads/thread-window";
import { useThread } from "../../features/threads/thread-context";
import { ThreadLoaderData } from "@/features/threads/thread-loader";

export function ThreadPage() {
  const { thread, messages: loadedMessages } =
    useLoaderData<ThreadLoaderData>();

  const { messages, isBusy, hydrate, sendMessage } = useThread();

  useEffect(() => {
    hydrate(thread, loadedMessages);
  }, [thread.id, hydrate, loadedMessages]);
  return (
    <div className="h-full">
      <ThreadWindow
        thread={thread}
        messages={messages}
        isBusy={isBusy}
        onSubmit={sendMessage}
      />
    </div>
  );
}

// Necessary for react router to lazy load.
export const Component = ThreadPage;
