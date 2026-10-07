import { BotIcon } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import { ClipboardButton } from "@/components/clipboard-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import type { ThreadAssistantMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RegenerateButton } from "./regenerate-button";

export function AssistantMessage({
  message,
  isLast,
  isStreaming,
  onRegenerate,
}: {
  message: ThreadAssistantMessage;
  /** The thread's last assistant message: its actions stay visible. */
  isLast: boolean;
  /** Still being written: avatar and actions wait for the end of the text. */
  isStreaming: boolean;
  /** Answers the question again; only given to the answer that can be redone. */
  onRegenerate: (() => void) | null;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Message align="start" className="group/message">
      {/*
       * Kept in the layout while hidden: the avatar sits at the bottom of the
       * message and would travel down with the text as it grows.
       */}
      <MessageAvatar
        aria-hidden={isStreaming}
        className={cn(
          "transition-opacity duration-150",
          isStreaming && "opacity-0"
        )}
      >
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
            "gap-2 transition-opacity duration-150",
            isLast
              ? // Always there, but not clickable before the text is complete.
                (isStreaming && "invisible") || "opacity-100"
              : "opacity-0 group-focus-within/message:opacity-100 group-hover/message:opacity-100",
            copied && "opacity-100"
          )}
        >
          <ClipboardButton
            content={message.content}
            onCopiedChanged={setCopied}
          />
          {onRegenerate && <RegenerateButton onClick={onRegenerate} />}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}
