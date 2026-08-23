import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import Markdown from "react-markdown";
import { RotateCwIcon, MessageCircleDashedIcon } from "lucide-react";
import { Thread, ThreadMessage } from "@/lib/types";
import { ThreadInput } from "./thread-input";
import { formatRelativeTime } from "@/lib/utils";

type ThreadWindowProps = {
  thread: Thread;
  messages: ThreadMessage[];
  isBusy: boolean;
  onSubmit: (input: string) => Promise<void>;
};

export function ThreadWindow({
  thread,
  messages,
  isBusy,
  onSubmit,
}: ThreadWindowProps) {
  return (
    <MessageScrollerProvider>
      <div className="relative flex flex-col gap-4 h-full">
        <Card className="mx-auto h-full w-full max-w-3xl gap-0">
          <CardHeader className="gap-1 border-b">
            <CardTitle>{thread.title}</CardTitle>
            <CardDescription>
              {formatRelativeTime(thread.updatedAt)}
            </CardDescription>
            <CardAction>
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Reset conversation"
                    onClick={() => true}
                    disabled={isBusy}
                  >
                    <RotateCwIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset</p>
                </TooltipContent>
              </Tooltip>
            </CardAction>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {messages.length === 0 ? (
              <Empty className="h-full">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MessageCircleDashedIcon />
                  </EmptyMedia>
                  <EmptyTitle>Morning, shadcn!</EmptyTitle>
                  <EmptyDescription>
                    What are we working on today? Press send to start a new
                    conversation
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <MessageScroller>
                <MessageScrollerViewport>
                  <MessageScrollerContent aria-busy={isBusy} className="p-4">
                    {messages.map((message) => (
                      <Message
                        key={message.id}
                        align={message.role === "user" ? "end" : "start"}
                      >
                        <MessageAvatar>
                          <Avatar>
                            <AvatarImage
                              src="https://github.com/shadcn.png"
                              alt="@shadcn"
                            />
                            <AvatarFallback>CN</AvatarFallback>
                          </Avatar>
                        </MessageAvatar>
                        <MessageContent>
                          <Bubble
                            variant={
                              message.role === "user" ? "default" : "secondary"
                            }
                          >
                            <BubbleContent>
                              {" "}
                              <Markdown>{message.content}</Markdown>
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    ))}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <ThreadInput onSubmit={onSubmit} isBusy={isBusy} />
          </CardFooter>
        </Card>
      </div>
    </MessageScrollerProvider>
  );
}
