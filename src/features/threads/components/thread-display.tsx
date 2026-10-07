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
import {
  assistantDisplay,
  groupMessages,
  isAwaitingFirstToken,
  regenerateSlot,
} from "../utils";
import { AssistantMessage } from "./assistant-message";
import { RunNotice } from "./run-notice";
import { ToolMessage } from "./tool-message";
import { UserMessage } from "./user-message";

function ItemContent({
  item,
  isLastAssistant,
  isStreaming,
  onRegenerate,
}: {
  item: RenderItem;
  isLastAssistant: boolean;
  isStreaming: boolean;
  /** Given only to the item that carries the "answer again" action. */
  onRegenerate: (() => void) | null;
}) {
  if (item.kind === "tool") {
    return <ToolMessage item={item} />;
  }
  if (item.kind === "notice") {
    return <RunNotice onRetry={onRegenerate} run={item.run} />;
  }
  if (item.message.role === "user") {
    return <UserMessage message={item.message} />;
  }
  return (
    <AssistantMessage
      isLast={isLastAssistant}
      isStreaming={isStreaming}
      message={item.message}
      onRegenerate={onRegenerate}
    />
  );
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
  const { lastKey, streamingKey } = assistantDisplay(items, isBusy);
  const redoKey = regenerateSlot(items);

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
                <ItemContent
                  isLastAssistant={item.key === lastKey}
                  isStreaming={item.key === streamingKey}
                  item={item}
                  onRegenerate={item.key === redoKey ? onRegenerate : null}
                />
                {/*
                 * Inside the last item, never a child of its own: the scroller
                 * finds a newly added message by its position among the
                 * children, and an extra child that comes and goes would
                 * shift it.
                 */}
                {awaitingFirstToken && index === items.length - 1 && (
                  <Marker className="pl-10" role="status">
                    <MarkerContent className="shimmer">Thinking…</MarkerContent>
                  </Marker>
                )}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
