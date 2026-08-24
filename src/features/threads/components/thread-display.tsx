import { useMemo } from "react";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { ThreadMessage } from "@/lib/types";
import { groupMessages } from "../utils";
import { AssistantMessage } from "./assistant-message";
import { ToolMessage } from "./tool-message";
import { UserMessage } from "./user-message";

export function ThreadDisplay({
  messages,
  isBusy,
}: {
  messages: ThreadMessage[];
  isBusy: boolean;
}) {
  const items = useMemo(() => groupMessages(messages), [messages]);

  return (
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent aria-busy={isBusy} className="p-4">
            {items.map((item) => {
              if (item.kind === "tool") {
                return <ToolMessage item={item} key={item.key} />;
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
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
