import type { ThreadMessage } from "@/lib/types";
import type { RenderItem } from "./types";

/**
 * Transforms a list of ThreadMessage into a list of RenderItem
 * ready to be displayed
 *
 *  - one "message" item for every user/assistant
 *  - one "tool" item grouping ThreadToolCall and ThreadToolResult (if it exists) via toolCallId
 *
 * Works the same for live or persisted message historic
 * @param messages
 * @returns
 */
export function groupMessages(messages: ThreadMessage[]): RenderItem[] {
  const items: RenderItem[] = [];
  const toolItemIndexByCallId = new Map<string, number>();

  for (const message of messages) {
    switch (message.role) {
      case "user":
      case "assistant": {
        items.push({ kind: "message", key: message.id, message });
        break;
      }

      case "tool_call": {
        toolItemIndexByCallId.set(message.toolCallId, items.length);
        items.push({ kind: "tool", key: message.toolCallId, call: message });
        break;
      }

      case "tool_result": {
        const index = toolItemIndexByCallId.get(message.toolCallId);
        const existing = index === undefined ? undefined : items[index];

        if (existing?.kind === "tool" && index !== undefined) {
          items[index] = { ...existing, result: message };
        }
        // We should not have a tool_result without its corresponding tool_call
        // if this is the case we silently ignore it
        // rather than crashing render

        break;
      }
      default:
        console.warn("Unknown message type", message);
    }
  }

  return items;
}
