import { describe, expect, it } from "vitest";
import type { ThreadMessage } from "@/lib/types";
import { groupMessages } from "./utils";

const base = { position: 0, thread_id: "t1" };

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
  tool_call_id: callId,
  tool_name: "echo",
  content: "{}",
});
const result = (callId: string): ThreadMessage => ({
  ...base,
  id: `row-${callId}-result`,
  role: "tool_result",
  tool_call_id: callId,
  tool_name: "echo",
  content: '"ok"',
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
