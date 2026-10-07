import type { AppErrorKind } from "./errors";
export type AppConfig = {
  theme: "light" | "dark" | "system";
  username: string;
};

type BaseAgentEvent = {
  data: { run_id: string };
};

export type ThreadCreatedEvent = {
  type: "ThreadCreated";
  data: { thread: Thread };
} & BaseAgentEvent;

export type RunStartedEvent = {
  type: "RunStarted";
  data: { thread_id: string };
} & BaseAgentEvent;

export type MessageStartedEvent = {
  type: "MessageStarted";
  data: { thread_id: string; message_id: string };
} & BaseAgentEvent;

export type MessageDeltaEvent = {
  type: "MessageDelta";
  data: { thread_id: string; message_id: string; text: string };
} & BaseAgentEvent;

export type MessageCompletedEvent = {
  type: "MessageCompleted";
  data: { thread_id: string; message_id: string };
} & BaseAgentEvent;

export type ToolCallStartedEvent = {
  type: "ToolCallStarted";
  data: {
    thread_id: string;
    tool_name: string;
    tool_call_id: string;
    arguments: string;
  };
} & BaseAgentEvent;

export type ToolCallCompletedEvent = {
  type: "ToolCallCompleted";
  data: {
    thread_id: string;
    tool_name: string;
    tool_call_id: string;
    content: string;
    is_error: boolean;
  };
} & BaseAgentEvent;

export type RunCompletedEvent = {
  type: "RunCompleted";
  data: { thread_id: string; messages: ThreadMessage[] };
} & BaseAgentEvent;

export type ErrorEvent = {
  type: "Error";
  data: { thread_id?: string; kind: AppErrorKind; message: string };
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
  thread_id: string;
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
  tool_call_id: string;
  tool_name: string;
  content: string;
} & ThreadBaseMessage;

export type ThreadToolResult = {
  role: "tool_result";
  tool_call_id: string;
  tool_name: string;
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
