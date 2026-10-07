import type { AppErrorKind } from "./errors";
export type AppConfig = {
  theme: "light" | "dark" | "system";
  username: string;
};

type BaseAgentEvent = {
  data: { runId: string };
};

export type ThreadCreatedEvent = {
  type: "ThreadCreated";
  data: { thread: Thread };
} & BaseAgentEvent;

export type RunStartedEvent = {
  type: "RunStarted";
  data: { threadId: string };
} & BaseAgentEvent;

export type MessageStartedEvent = {
  type: "MessageStarted";
  data: { threadId: string; messageId: string };
} & BaseAgentEvent;

export type MessageDeltaEvent = {
  type: "MessageDelta";
  data: { threadId: string; messageId: string; text: string };
} & BaseAgentEvent;

export type MessageCompletedEvent = {
  type: "MessageCompleted";
  data: { threadId: string; messageId: string };
} & BaseAgentEvent;

export type ToolCallStartedEvent = {
  type: "ToolCallStarted";
  data: {
    threadId: string;
    toolName: string;
    toolCallId: string;
    arguments: string;
  };
} & BaseAgentEvent;

export type ToolCallCompletedEvent = {
  type: "ToolCallCompleted";
  data: {
    threadId: string;
    toolName: string;
    toolCallId: string;
    content: string;
    isError: boolean;
  };
} & BaseAgentEvent;

export type RunCompletedEvent = {
  type: "RunCompleted";
  data: {
    threadId: string;
    /** `cancelled` when the user stopped the run: messages are what it had produced. */
    status: "completed" | "cancelled";
    messages: ThreadMessage[];
  };
} & BaseAgentEvent;

export type ErrorEvent = {
  type: "Error";
  data: { threadId?: string; kind: AppErrorKind; message: string };
} & BaseAgentEvent;

export type AgentEvent =
  | ThreadCreatedEvent
  | RunStartedEvent
  | MessageStartedEvent
  | MessageDeltaEvent
  | MessageCompletedEvent
  | ToolCallStartedEvent
  | ToolCallCompletedEvent
  | RunCompletedEvent
  | ErrorEvent;

type ThreadBaseMessage = {
  id: string;
  position: number;
  createdAt?: number;
  threadId: string;
  /** Run that produced the row; absent on optimistic messages and old rows. */
  runId?: string | null;
};

export type ThreadUserMessage = {
  role: "user";
  content: string;
} & ThreadBaseMessage;

export type ThreadAssistantMessage = {
  role: "assistant";
  content: string;
} & ThreadBaseMessage;

export type ThreadToolCall = {
  role: "tool_call";
  toolCallId: string;
  toolName: string;
  content: string;
} & ThreadBaseMessage;

export type ThreadToolResult = {
  role: "tool_result";
  toolCallId: string;
  toolName: string;
  content: string;
  /** The call failed: the model saw `content` as its result and went on. */
  isError: boolean;
} & ThreadBaseMessage;

export type ThreadMessage =
  | ThreadUserMessage
  | ThreadAssistantMessage
  | ThreadToolCall
  | ThreadToolResult;

/** Mirrors `RunSummary` in src-tauri/src/db/models.rs. */
export type RunSummary = {
  id: string;
  provider: string;
  model: string;
  status: "running" | "completed" | "failed" | "cancelled";
  error: string | null;
  startedAt: number;
  endedAt: number | null;
};

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};
