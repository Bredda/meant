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

/**
 * Whether a run is on but has shown nothing yet: the question is the last
 * message, so the model is still working on its first token.
 */
export function isAwaitingFirstToken(
  messages: ThreadMessage[],
  isBusy: boolean
): boolean {
  const [last] = messages.slice(-1);
  return isBusy && last?.role === "user";
}

/**
 * Which assistant message gets special treatment while the list is shown:
 * the last one keeps its footer actions visible, and the one being written
 * (last item of the list while a run is on) holds back avatar and footer
 * until it is finished, so they do not travel down with the text.
 */
export function assistantDisplay(
  items: RenderItem[],
  isBusy: boolean
): { lastKey: string | null; streamingKey: string | null } {
  const isAssistant = (item: RenderItem | undefined) =>
    item?.kind === "message" && item.message.role === "assistant";

  let lastKey: string | null = null;
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (item && isAssistant(item)) {
      lastKey = item.key;
      break;
    }
  }

  const [lastItem] = items.slice(-1);

  return {
    lastKey,
    streamingKey:
      lastItem && isBusy && isAssistant(lastItem) ? lastItem.key : null,
  };
}

/**
 * The item that carries the "answer again" action: the last assistant message
 * after the last question, or, when that question got no answer (the run
 * failed or was stopped first), the notice that follows it. `null` when
 * there is nothing to answer again.
 */
export function regenerateSlot(items: RenderItem[]): string | null {
  let slot: string | null = null;

  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (!item) {
      continue;
    }
    if (item.kind === "message" && item.message.role === "user") {
      return slot;
    }
    const isAnswer = item.kind === "message";
    const isNotice = item.kind === "notice";
    if (isAnswer) {
      return item.key;
    }
    if (isNotice && slot === null) {
      slot = item.key;
    }
  }

  return null;
}
