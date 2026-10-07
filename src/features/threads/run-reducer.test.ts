import { describe, expect, it } from "vitest";
import type { ThreadMessage } from "@/lib/types";
import { isRunDisplayed, runReducer } from "./run-reducer";

const message = (
  id: string,
  role: "user" | "assistant",
  content = ""
): ThreadMessage => ({ id, role, content, position: 0, threadId: "t1" });

describe("runReducer", () => {
  it("appends streamed text to the open assistant segment only", () => {
    const start = [message("u1", "user", "hi"), message("a1", "assistant")];

    const next = runReducer(start, {
      type: "appendText",
      messageId: "a1",
      text: "Hello",
    });

    expect(next.map((m) => m.content)).toEqual(["hi", "Hello"]);
  });

  it("annotates the open segment on failure", () => {
    const start = [message("a1", "assistant", "partial")];

    const next = runReducer(start, {
      type: "fail",
      messageId: "a1",
      warning: "boom",
      fallback: message("x", "assistant", "⚠️ boom"),
    });

    expect(next).toHaveLength(1);
    expect(next[0]?.content).toBe("partial\n\n⚠️ boom");
  });

  it("appends the fallback when no segment is open", () => {
    const next = runReducer([message("u1", "user")], {
      type: "fail",
      messageId: null,
      warning: "boom",
      fallback: message("x", "assistant", "⚠️ boom"),
    });

    expect(next.map((m) => m.id)).toEqual(["u1", "x"]);
  });

  it("replaces the live view with snapshot + persisted rows on completion", () => {
    const snapshot = [message("old", "user")];
    const live = [
      ...snapshot,
      message("tmp", "user"),
      message("a1", "assistant"),
    ];
    const persisted = [
      message("u-db", "user"),
      message("a1", "assistant", "done"),
    ];

    const next = runReducer(live, { type: "complete", snapshot, persisted });

    expect(next.map((m) => m.id)).toEqual(["old", "u-db", "a1"]);
  });
});

describe("isRunDisplayed", () => {
  it("is true for the run's own thread", () => {
    expect(isRunDisplayed("t1", "t1")).toBe(true);
  });

  it("is false once another thread is displayed", () => {
    expect(isRunDisplayed("t1", "t2")).toBe(false);
    expect(isRunDisplayed("t1", null)).toBe(false);
  });

  it("is true for a new-thread run on the new-thread page", () => {
    expect(isRunDisplayed(null, null)).toBe(true);
  });
});

describe("runReducer after a failed run", () => {
  it("shows the persisted rows followed by the warning", () => {
    const live = [
      message("tmp-user", "user", "hi"),
      message("w1", "assistant", "⚠️ boom"),
    ];
    const persisted = [message("u-db", "user", "hi")];

    const next = runReducer(live, {
      type: "reloadAfterFailure",
      persisted,
      warningId: "w1",
    });

    expect(next.map((m) => m.id)).toEqual(["u-db", "w1"]);
  });
});
