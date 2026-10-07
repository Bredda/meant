import { useMemo } from "react";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { RunSummary, ThreadMessage } from "@/lib/types";
import { groupMessages, isAwaitingFirstToken } from "../utils";
import { AssistantMessage } from "./assistant-message";
import { RegenerateButton } from "./regenerate-button";
import { RunNotice } from "./run-notice";
import { ToolMessage } from "./tool-message";
import { UserMessage } from "./user-message";

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

  return (
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent aria-busy={isBusy} className="gap-4 p-4">
            {items.map((item) => {
              if (item.kind === "tool") {
                return <ToolMessage item={item} key={item.key} />;
              }
              if (item.kind === "notice") {
                return <RunNotice key={item.key} run={item.run} />;
              }
              if (item.message.role === "user") {
                return <UserMessage key={item.key} message={item.message} />;
              }
              if (item.message.role === "assistant") {
                return (
                  <AssistantMessage key={item.key} message={item.message} />
                );
              }
              return (
                <div className="text-destructive" key="unknown">
                  Unknown message type
                </div>
              );
            })}
            {awaitingFirstToken && (
              <Marker className="pl-10" role="status">
                <MarkerContent className="shimmer">Thinking…</MarkerContent>
              </Marker>
            )}
            {onRegenerate && <RegenerateButton onClick={onRegenerate} />}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
