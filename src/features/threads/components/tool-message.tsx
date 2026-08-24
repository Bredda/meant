import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import type { RenderToolItem } from "../types";
import { ToolCallItem } from "./tool-call-item";
export function ToolMessage({ item }: { item: RenderToolItem }) {
  return (
    <Message align="start" key={item.key}>
      <MessageAvatar />
      <MessageContent>
        <ToolCallItem call={item.call} result={item.result} />
      </MessageContent>
    </Message>
  );
}
