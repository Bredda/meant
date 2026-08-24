import { useState } from "react";
import Markdown from "react-markdown";
import { Clipboardbutton } from "@/components/clipboard-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import type { ThreadUserMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function UserMessage({ message }: { message: ThreadUserMessage }) {
  const [copied, setCopied] = useState(false);

  return (
    <Message align="end" className="group/message">
      <MessageAvatar>
        <Avatar>
          <AvatarImage alt="@shadcn" src="https://github.com/shadcn.png" />
          <AvatarFallback>CN</AvatarFallback>
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
