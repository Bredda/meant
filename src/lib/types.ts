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
  data: { threadId: string; messages: ThreadMessage[] };
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
} & ThreadBaseMessage;

export type ThreadMessage =
  | ThreadUserMessage
  | ThreadAssistantMessage
  | ThreadToolCall
  | ThreadToolResult;

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};
