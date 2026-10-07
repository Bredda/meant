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
      /** The message carrying the failure warning. */
      warningId: string;
      /**
       * Whether the warning must stay after the rows: only when the failure
       * left no run row to show it (it happened before the run was recorded).
       */
      keepWarning: boolean;
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
    // really are (so the next run's snapshot matches the database). The
    // failure itself is then shown from the run row, except when it left none.
    case "reloadAfterFailure": {
      if (!action.keepWarning) {
        return action.persisted;
      }
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

/**
 * The messages up to and including the last user message: what a regenerated
 * run answers, and what stays on screen while it streams. `null` when there
 * is no user message to answer.
 */
export function messagesThroughLastUser(
  messages: ThreadMessage[]
): ThreadMessage[] | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === "user") {
      return messages.slice(0, index + 1);
    }
  }
  return null;
}
