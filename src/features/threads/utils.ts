import type { RunSummary, Thread, ThreadMessage } from "@/lib/types";
import type { RenderItem } from "./types";

/**
 * Transforms a list of ThreadMessage into a list of RenderItem
 * ready to be displayed
 *
 *  - one "message" item for every user/assistant
 *  - one "tool" item grouping ThreadToolCall and ThreadToolResult (if it exists) via toolCallId
 *  - one "notice" item after the last item of every failed or cancelled run,
 *    so a failure stays visible after a restart (runs are persisted)
 *
 * Works the same for live or persisted message historic
 * @param messages
 * @param runs the thread's persisted runs, empty while nothing is loaded
 * @returns
 */
export function groupMessages(
  messages: ThreadMessage[],
  runs: RunSummary[] = []
): RenderItem[] {
  const items: RenderItem[] = [];
  const toolItemIndexByCallId = new Map<string, number>();
  // Index of the last item each run produced, where its notice goes.
  const lastItemByRunId = new Map<string, number>();

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

    if (message.runId) {
      lastItemByRunId.set(message.runId, items.length - 1);
    }
  }

  return withRunNotices(items, runs, lastItemByRunId);
}

function withRunNotices(
  items: RenderItem[],
  runs: RunSummary[],
  lastItemByRunId: Map<string, number>
): RenderItem[] {
  const endedEarly = runs.filter(
    (run) =>
      (run.status === "failed" || run.status === "cancelled") &&
      lastItemByRunId.has(run.id)
  );
  if (endedEarly.length === 0) {
    return items;
  }

  return items.flatMap((item, index) => [
    item,
    ...endedEarly
      .filter((run) => lastItemByRunId.get(run.id) === index)
      .map(
        (run): RenderItem => ({ kind: "notice", key: `run:${run.id}`, run })
      ),
  ]);
}

const DIACRITICS = /\p{Diacritic}/gu;

function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

/** The threads whose title contains `query`, ignoring case and accents. */
export function filterThreads(threads: Thread[], query: string): Thread[] {
  const needle = normalizeForSearch(query.trim());
  if (!needle) {
    return threads;
  }
  return threads.filter((thread) =>
    normalizeForSearch(thread.title).includes(needle)
  );
}
