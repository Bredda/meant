import type {
  ThreadAssistantMessage,
  ThreadToolCall,
  ThreadToolResult,
  ThreadUserMessage,
} from "@/lib/types";

export type RenderMessageItem = {
  kind: "message";
  key: string;
  message: ThreadUserMessage | ThreadAssistantMessage;
};
export type RenderToolItem = {
  kind: "tool";
  key: string;
  call: ThreadToolCall;
  result?: ThreadToolResult;
};
/**
 * Regroups flats messages into items ready to be displayed
 *  - one "message" item for every user/assistant
 *  - one "tool" item grouping ThreadToolCall and ThreadToolResult (if it exists) via tool_call_id
 *
 * Works the same for live or persisted message historic
 */
export type RenderItem = RenderToolItem | RenderMessageItem;
