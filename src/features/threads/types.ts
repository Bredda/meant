import type {
  RunSummary,
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
/** How a run that did not complete ended, shown after its last message. */
export type RenderNoticeItem = {
  kind: "notice";
  key: string;
  run: RunSummary;
};
/**
 * Regroups flats messages into items ready to be displayed
 *  - one "message" item for every user/assistant
 *  - one "tool" item grouping ThreadToolCall and ThreadToolResult (if it exists) via toolCallId
 *  - one "notice" item after the last message of every failed or cancelled run
 *
 * Works the same for live or persisted message historic
 */
export type RenderItem = RenderToolItem | RenderMessageItem | RenderNoticeItem;
