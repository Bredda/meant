# Agent Architecture

This document describes how Meant executes an AI agent run: how a conversation turns into a model call, how tool execution is woven into that call, and how the result is streamed to and reconciled with the UI.

It complements [ARCHITECTURE.md](./ARCHITECTURE.md), which covers the wider application boundaries (Tauri, storage, UI).

---

## 1. Overview

The agent layer sits behind a single entry point — a `chat` command — and is responsible for:

- Turning a thread's message history into a model conversation.
- Running a ReAct-style loop: the model can respond with text, call a tool, observe the result, and continue.
- Streaming everything that happens during the run to the UI as it happens.
- Producing a final, authoritative list of messages to persist once the run completes.

The agent is built on **Rig**, which provides the model-provider abstraction and the multi-turn streaming primitives. The application does not depend on a specific provider (Anthropic, OpenAI, local runtime) beyond this boundary.

```text
Thread Provider (React)
        │
        ▼
   chat command (Rust)
        │
        ├── persists the incoming user message
        ├── loads thread history
        ▼
     Agent.run()
        │
        ├── streams events back to React (live view)
        └── returns the final list of produced messages
        │
        ▼
   chat command persists
   the produced messages,
   then emits RunCompleted
```

---

## 2. Run Lifecycle

A **run** is one execution of the agent against a thread, triggered by a new user message.

1. The thread is resolved (existing, or created for a first message) and the provider chosen. A missing key fails here, before anything is written.
2. The run is recorded in the `runs` table as `running`.
3. The user message is persisted immediately, before the model is called.
4. The full message history is loaded and handed to the agent.
5. The agent streams the model's response, executing tools as needed, until it produces a final answer.
6. Everything the run produced (assistant text, tool calls, tool results) is persisted in one transaction.
7. The UI is given the authoritative, persisted version of what happened, and the run is closed as `completed`, or as `failed` with its error.

This lifecycle is intentionally linear: persistence of the user message happens *before* the model runs, and persistence of everything else happens *after* the run completes, all or nothing. A failed run therefore leaves the user message and a `failed` run row; text streamed before the failure is not stored. On a failure the UI reloads the thread's rows and keeps the error warning after them.

---

## 3. Streaming Event Model

While a run is in progress, the agent emits a sequence of events over a Tauri channel. These events let the UI render the run as it happens, without waiting for it to finish.

Conceptually, a run produces a *sequence of segments*:

```text
ThreadCreated (only if this is a new thread)
RunStarted

  MessageStarted → MessageDelta* → MessageCompleted     (assistant text)
  ToolCallStarted → ToolCallCompleted                    (a tool call, zero or more)
  MessageStarted → MessageDelta* → MessageCompleted      (assistant text, again)
  ...

RunCompleted (carries the final, persisted messages)
```

A single run can contain **multiple assistant text segments**, interleaved with tool calls — this is the normal shape of a ReAct loop (the model writes something, calls a tool, then continues writing based on the result).

Two events act as terminals for the whole run:

- **`RunCompleted`** — the run finished normally. It carries the complete, persisted list of messages produced by the run, which the UI treats as authoritative.
- **`Error`** — the run failed. It carries a `kind` (`provider` for a failed completion: rejected key, network, rate limit; `internal` otherwise) and a message. It is emitted once, by `RunService`; the UI ignores the matching `invoke` rejection.

---

## 4. Message Identity & Reconciliation

This is the central design decision of the agent/UI boundary, and worth calling out explicitly.

**Problem:** the UI builds a live view of the run purely from streamed events (deltas, tool call events), before anything is persisted. Once the run completes, the UI receives the real, persisted messages. These two representations need to reconcile into a single, stable view — without messages jumping around, flashing, or duplicating.

**Approach:**

- Each assistant text segment is assigned an id up front (at `MessageStarted`), and that same id is reused when the segment is persisted. This id is stable from the first token streamed to the final stored row.
- Tool calls are matched between their live and persisted representations using the tool call's own id (not the storage row id, which is only assigned at persistence time).
- Rather than trying to patch the live view in place once the run completes, the UI **replaces** its live-built state with the authoritative list from `RunCompleted`, appended to a snapshot of the messages that existed before the run started.

This "snapshot + replace" strategy avoids fragile per-message diffing: the live view exists only to give the user immediate feedback while a run is in progress, and is always superseded wholesale by the persisted result.

---

## 5. Tool Execution

Tools are the mechanism by which the agent takes action beyond generating text — reading files, running commands, calling external services.

### Native tools vs. MCP tools

- **Native tools** are implemented directly in Rust and exposed to the agent through Rig's tool abstraction.
- **MCP tools** come from external MCP servers and are exposed through the same abstraction, so the agent loop does not need to distinguish between the two.

### Error handling philosophy

A tool can fail in two meaningfully different ways:

- **A recoverable, "business" failure** (a file doesn't exist, a query is invalid) — this is information the model should see and can act on, so it is treated as a normal tool result rather than an error that halts the run.
- **A fatal failure** (misconfiguration, unrecoverable internal error) — this is allowed to interrupt the run and surface as an `Error` event.

The distinction between the two, and how it's surfaced to the UI (e.g. visually marking a tool call as failed), is an evolving convention layered on top of what the underlying model-provider library exposes — it is not yet fully standardized across all tools.

---

## 6. Current Status & Open Questions

- Tool results are stored and replayed as plain text (the concatenated text parts of the tool output).
- Tool-call failure signaling to the UI (`isError`) is defined in the event model but not yet backed by a consistent convention across native tools.
- Multi-turn behavior when a tool itself errors out (does it end the run, or let the model retry?) is still being validated against Rig's actual behavior.
- Runs are persisted (status, provider, model, error) but not yet shown in the UI, and a run cannot be cancelled.

This document reflects the target shape of the agent boundary; implementation details (event payload shapes, exact Rig APIs) live in code, not here.
