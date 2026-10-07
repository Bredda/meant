import type { ThreadMessage } from "@/lib/types";

/**
 * Changes a run applies to the displayed messages. Kept pure (no refs, no
 * React) so the live view of a run can be tested without the Tauri channel.
 */
export type RunAction =
  | { type: "append"; message: ThreadMessage }
  | { type: "appendText"; messageId: string; text: string }
  | {
      type: "fail";
      /** Open assistant segment to annotate, if any. */
      messageId: string | null;
      warning: string;
      /** Shown when there is no open segment (e.g. failure during a tool call). */
      fallback: ThreadMessage;
    }
  | { type: "complete"; snapshot: ThreadMessage[]; persisted: ThreadMessage[] }
  | {
      type: "reloadAfterFailure";
      persisted: ThreadMessage[];
      /** The message carrying the failure warning, kept after the rows. */
      warningId: string;
    };

export function runReducer(
  messages: ThreadMessage[],
  action: RunAction
): ThreadMessage[] {
  switch (action.type) {
    case "append":
      return [...messages, action.message];

    case "appendText":
      return messages.map((message) =>
        message.id === action.messageId && message.role === "assistant"
          ? { ...message, content: message.content + action.text }
          : message
      );

    case "fail": {
      const segment = messages.find(
        (message) =>
          message.id === action.messageId && message.role === "assistant"
      );
      if (!segment) {
        return [...messages, action.fallback];
      }
      return messages.map((message) =>
        message === segment
          ? {
              ...message,
              content: message.content
                ? `${message.content}\n\n⚠️ ${action.warning}`
                : `⚠️ ${action.warning}`,
            }
          : message
      );
    }

    // Persisted rows are authoritative: the live view is dropped wholesale
    // rather than reconciled message by message (see reference/agents.md).
    case "complete":
      return [...action.snapshot, ...action.persisted];

    // A failed run persists only the user message: show the rows as they
    // really are (so the next run's snapshot matches the database), plus the
    // warning, which exists only in the UI until runs are persisted.
    case "reloadAfterFailure": {
      const warning = messages.find(
        (message) => message.id === action.warningId
      );
      return warning ? [...action.persisted, warning] : action.persisted;
    }

    default:
      return messages;
  }
}

/**
 * Whether a run's events may touch the displayed messages. The provider is
 * shared by every thread route, so a run keeps streaming after the user has
 * opened another thread; its events must then leave that thread alone.
 * A run whose thread does not exist yet (`null`) belongs to the new-thread page.
 */
export function isRunDisplayed(
  runThreadId: string | null,
  displayedThreadId: string | null
): boolean {
  return runThreadId === displayedThreadId;
}
