import { useState } from "react";
import Markdown from "react-markdown";
import { ClipboardButton } from "@/components/clipboard-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import type { ThreadUserMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/config-store";

export function UserMessage({ message }: { message: ThreadUserMessage }) {
  const [copied, setCopied] = useState(false);
  const initials = useConfigStore(
    (s) => s.config?.username.slice(0, 2).toUpperCase() ?? ""
  );

  return (
    <Message align="end" className="group/message">
      <MessageAvatar>
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <Bubble variant="default">
          <BubbleContent className="prose dark:prose-invert">
            <Markdown>{message.content}</Markdown>
          </BubbleContent>
        </Bubble>
        <MessageFooter
          className={cn(
            "gap-2 opacity-0 transition-opacity duration-150 group-focus-within/message:opacity-100 group-hover/message:opacity-100",
            copied && "opacity-100"
          )}
        >
          <ClipboardButton
            content={message.content}
            onCopiedChanged={setCopied}
          />
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
