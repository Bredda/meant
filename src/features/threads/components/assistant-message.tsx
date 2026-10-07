import { BotIcon } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import { Clipboardbutton } from "@/components/clipboard-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import type { ThreadAssistantMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AssistantMessage({
  message,
}: {
  message: ThreadAssistantMessage;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Message align="start" className="group/message">
      <MessageAvatar>
        <Avatar>
          <AvatarFallback>
            <BotIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <div className="prose dark:prose-invert">
          <Markdown>{message.content}</Markdown>
        </div>
        <MessageFooter
          className={cn(
            "gap-2 opacity-0 transition-opacity duration-150 group-focus-within/message:opacity-100 group-hover/message:opacity-100",
            copied && "opacity-100"
          )}
        >
          <Clipboardbutton
            content={message.content}
            copied={copied}
            onCopiedChanged={setCopied}
          />
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
