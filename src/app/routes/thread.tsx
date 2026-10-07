import { useEffect } from "react";
import { useLoaderData } from "react-router";
import type { ThreadLoaderData } from "@/features/threads/thread-loader";
import { ThreadWindow } from "../../features/threads/components/thread-window";
import { messagesThroughLastUser } from "../../features/threads/run-reducer";
import { useThread } from "../../features/threads/thread-context";

export function ThreadPage() {
  const {
    thread,
    messages: loadedMessages,
    runs: loadedRuns,
  } = useLoaderData<ThreadLoaderData>();

  const {
    messages,
    runs,
    isBusy,
    cancelRun,
    hydrate,
    regenerate,
    sendMessage,
  } = useThread();

  // Nothing to redo while a response streams or before a question exists.
  const canRegenerate = !isBusy && messagesThroughLastUser(messages) !== null;

  useEffect(() => {
    hydrate(thread, loadedMessages, loadedRuns);
  }, [thread, hydrate, loadedMessages, loadedRuns]);
  return (
    <div className="h-full min-h-0">
      <ThreadWindow
        isBusy={isBusy}
        messages={messages}
        onCancel={cancelRun}
        onRegenerate={canRegenerate ? regenerate : null}
        onSubmit={sendMessage}
        runs={runs}
        thread={thread}
      />
    </div>
  );
}

// Necessary for react router to lazy load.
export const Component = ThreadPage;
