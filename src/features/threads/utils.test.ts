import { describe, expect, it } from "vitest";
import type { RunSummary, Thread, ThreadMessage } from "@/lib/types";
import { filterThreads, groupMessages } from "./utils";

const base = { position: 0, threadId: "t1" };

const user = (id: string): ThreadMessage => ({
  ...base,
  id,
  role: "user",
  content: id,
});
const assistant = (id: string): ThreadMessage => ({
  ...base,
  id,
  role: "assistant",
  content: id,
});
const call = (callId: string): ThreadMessage => ({
  ...base,
  id: `row-${callId}`,
  role: "tool_call",
  toolCallId: callId,
  toolName: "echo",
  content: "{}",
});
const result = (callId: string): ThreadMessage => ({
  ...base,
  id: `row-${callId}-result`,
  role: "tool_result",
  toolCallId: callId,
  toolName: "echo",
  content: '"ok"',
  isError: false,
});

describe("groupMessages", () => {
  it("keeps user and assistant messages as message items", () => {
    const items = groupMessages([user("u1"), assistant("a1")]);

    expect(items.map((i) => i.kind)).toEqual(["message", "message"]);
    expect(items.map((i) => i.key)).toEqual(["u1", "a1"]);
  });

  it("pairs a tool call with its result into one tool item", () => {
    const items = groupMessages([user("u1"), call("c1"), result("c1")]);

    expect(items).toHaveLength(2);
    const tool = items[1];
    expect(tool?.kind).toBe("tool");
    if (tool?.kind === "tool") {
      expect(tool.key).toBe("c1");
      expect(tool.result?.content).toBe('"ok"');
    }
  });

  it("leaves a pending tool call without result", () => {
    const items = groupMessages([user("u1"), call("c1")]);
    const tool = items[1];

    expect(tool?.kind === "tool" && tool.result).toBeUndefined();
  });

  it("ignores a result without a matching call", () => {
    const items = groupMessages([user("u1"), result("c9")]);

    expect(items).toHaveLength(1);
  });
});

describe("groupMessages with a tool call first", () => {
  it("attaches the result when the call is the first item", () => {
    const items = groupMessages([call("c1"), result("c1")]);
    const tool = items[0];

    expect(items).toHaveLength(1);
    expect(tool?.kind === "tool" && tool.result?.content).toBe('"ok"');
  });
});

describe("groupMessages with persisted runs", () => {
  const inRun = (message: ThreadMessage, runId: string): ThreadMessage => ({
    ...message,
    runId,
  });
  const run = (
    id: string,
    status: RunSummary["status"],
    error: string | null = null
  ): RunSummary => ({
    id,
    provider: "anthropic",
    model: "m",
    status,
    error,
    startedAt: 0,
    endedAt: null,
  });
  const kinds = (items: ReturnType<typeof groupMessages>) =>
    items.map((i) => i.kind);

  it("adds a notice after a failed run that has no answer", () => {
    const items = groupMessages(
      [inRun(user("u1"), "r1")],
      [run("r1", "failed", "Provider error: 401")]
    );

    expect(kinds(items)).toEqual(["message", "notice"]);
    const notice = items[1];
    expect(notice?.kind === "notice" && notice.run.error).toBe(
      "Provider error: 401"
    );
  });

  it("places the notice after the last item of its own run", () => {
    const items = groupMessages(
      [
        inRun(user("u1"), "r1"),
        inRun(call("c1"), "r1"),
        inRun(result("c1"), "r1"),
        inRun(user("u2"), "r2"),
      ],
      [run("r1", "cancelled"), run("r2", "completed")]
    );

    expect(kinds(items)).toEqual(["message", "tool", "notice", "message"]);
  });

  it("shows no notice for running or completed runs", () => {
    const items = groupMessages(
      [inRun(user("u1"), "r1"), inRun(user("u2"), "r2")],
      [run("r1", "completed"), run("r2", "running")]
    );

    expect(kinds(items)).toEqual(["message", "message"]);
  });

  it("skips a run none of the displayed messages belongs to", () => {
    const items = groupMessages([user("u1")], [run("r9", "failed", "x")]);

    expect(kinds(items)).toEqual(["message"]);
  });
});

describe("filterThreads", () => {
  const thread = (id: string, title: string): Thread => ({
    id,
    title,
    createdAt: 0,
    updatedAt: 0,
  });
  const threads = [
    thread("t1", "Tri d'un vecteur Rust"),
    thread("t2", "Café ou thé ?"),
    thread("t3", "Notes de réunion"),
  ];
  const ids = (list: Thread[]) => list.map((t) => t.id);

  it("keeps every thread for an empty or blank query", () => {
    expect(filterThreads(threads, "")).toBe(threads);
    expect(filterThreads(threads, "   ")).toBe(threads);
  });

  it("ignores case and accents on both sides", () => {
    expect(ids(filterThreads(threads, "CAFE"))).toEqual(["t2"]);
    expect(ids(filterThreads(threads, "reunion"))).toEqual(["t3"]);
    expect(ids(filterThreads(threads, "thé"))).toEqual(["t2"]);
  });

  it("matches anywhere in the title and keeps the list order", () => {
    expect(ids(filterThreads(threads, "e"))).toEqual(["t1", "t2", "t3"]);
    expect(ids(filterThreads(threads, "vecteur"))).toEqual(["t1"]);
  });

  it("returns nothing when no title matches", () => {
    expect(filterThreads(threads, "zzz")).toEqual([]);
  });
});
