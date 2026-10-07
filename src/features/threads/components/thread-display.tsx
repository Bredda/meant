import { useMemo } from "react";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { RunSummary, ThreadMessage } from "@/lib/types";
import type { RenderItem } from "../types";
import { groupMessages, isAwaitingFirstToken } from "../utils";
import { AssistantMessage } from "./assistant-message";
import { RegenerateButton } from "./regenerate-button";
import { RunNotice } from "./run-notice";
import { ToolMessage } from "./tool-message";
import { UserMessage } from "./user-message";

function ItemContent({ item }: { item: RenderItem }) {
  if (item.kind === "tool") {
    return <ToolMessage item={item} />;
  }
  if (item.kind === "notice") {
    return <RunNotice run={item.run} />;
  }
  if (item.message.role === "user") {
    return <UserMessage message={item.message} />;
  }
  return <AssistantMessage message={item.message} />;
}

export function ThreadDisplay({
  messages,
  runs,
  isBusy,
  onRegenerate,
}: {
  messages: ThreadMessage[];
  runs: RunSummary[];
  isBusy: boolean;
  /** Answers the last user message again; `null` when there is nothing to redo. */
  onRegenerate: (() => void) | null;
}) {
  const items = useMemo(() => groupMessages(messages, runs), [messages, runs]);
  // The question is sent, no answer has started: the model is still working.
  const awaitingFirstToken = isAwaitingFirstToken(messages, isBusy);

  /*
   * Lives inside the last item, never as a child of its own: the scroller
   * finds a newly added message by its position among the children, and an
   * extra child that comes and goes would shift it.
   */
  const tail = (
    <>
      {awaitingFirstToken && (
        <Marker className="pl-10" role="status">
          <MarkerContent className="shimmer">Thinking…</MarkerContent>
        </Marker>
      )}
      {onRegenerate && <RegenerateButton onClick={onRegenerate} />}
    </>
  );

  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent aria-busy={isBusy} className="gap-4 p-4">
            {items.map((item, index) => (
              <MessageScrollerItem
                className="flex flex-col gap-4"
                key={item.key}
                messageId={item.key}
                // A sent question scrolls into view, whatever the position.
                scrollAnchor={
                  item.kind === "message" && item.message.role === "user"
                }
              >
                <ItemContent item={item} />
                {index === items.length - 1 && tail}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
