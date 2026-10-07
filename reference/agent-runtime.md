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

This lifecycle is intentionally linear: persistence of the user message happens *before* the model runs, and persistence of everything else happens *after* the run completes, all or nothing. A failed run therefore leaves the user message and a `failed` run row; text streamed before the failure is not stored. `get_thread` returns the thread's runs next to its messages, and the UI shows a notice after the last message of every `failed` run (with its error), also after a restart. Right after a failure the UI reloads the thread once `invoke` has settled (the run row is closed after the `Error` event, so reloading on the event would still read `running`); the live warning only stays when the failure happened before the run was recorded (e.g. no key configured).

---

### Regenerating an answer

`regenerate` runs the same pipeline as `chat` (same events, same registry, same run row) but answers the thread's last user message again instead of storing a new one. The model sees the history up to that message; the previous answer (everything after it) stays in the database until the new output replaces it in one transaction (`replace_messages_after`), so a failed run leaves it untouched. The user message is handed over to the new run. A run stopped before it produced anything keeps the previous answer too. `RunCompleted` carries only the new output; the UI shows the messages up to the user message while it streams, and `[...those, ...persisted]` once it ends.

### Thread titles

A thread starts with a provisional title (the beginning of its first message) and `threads.title_source = 'default'`. Once a `completed` run is closed, `ai/title.rs` names the thread in the background when it is still `default` and holds exactly one question and a text answer: one extra call to the same provider and model, no tools, with a bounded excerpt of the exchange. The result is stored with `UPDATE … WHERE title_source = 'default'`, so a title the user typed in the meantime always wins, and Rust emits the `thread-title-updated` app event (not on the run's channel, which is closed by then) that makes the UI refresh its route data. A failure is only logged; the provisional title stays. This is the one place where a conversation's text goes to the provider outside a run.

### Stopping a run

A run is registered (`RunRegistry`, one run per thread) with a cancel signal. The `cancel_run` command fires it; the runtime, which waits on the model's stream, sees it, ends early and returns what it produced with the `Cancelled` outcome. The run then goes through the same persistence step as a completed one and its row is closed as `cancelled`. A thread with a run in progress cannot be deleted.

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

- **`RunCompleted`** — the run finished normally, or was stopped by the user (`status` is `completed` or `cancelled`). It carries the complete, persisted list of messages produced by the run, which the UI treats as authoritative. A stopped run keeps what it had produced (partial text, finished tool calls); a tool call that had no result yet is dropped, since a history with an unanswered call is invalid for providers.
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

A recoverable failure is a tool returning `Err`: Rig turns it into a result whose text is the error message, the model sees it and the run goes on. The result item that reaches the stream carries only that text, so `ReActAgent` attaches a per-run Rig hook (`FailedToolCalls`, `on_tool_result`) that records the calls that did not succeed (failed, refused or skipped) by call id, and reads it when the matching result arrives. That flag travels as `isError` on `ToolCallCompleted`, is stored on the `tool_result` row (`messages.is_error`) and marks the call as failed in the UI, live and after a restart. The model only ever replays the text.

---

## 6. Current Status & Open Questions

- Tool results are stored and replayed as plain text (the concatenated text parts of the tool output).
- `isError` is backed by Rig's hook for every tool. Only `echo` (empty text) fails on purpose so far; a fatal failure that should stop the run (as opposed to a business error) has no convention yet.
- Whether the model retries after a failed call, and how a run behaves when a tool errors out, was checked in Rig's source and tests only, not against a real model.
- Runs are persisted (status, provider, model, error); `failed` and `cancelled` ones are shown in the thread.
- A run can be stopped (see below); a tool executing at that moment is abandoned, which will matter for tools with side effects.

This document reflects the target shape of the agent boundary; implementation details (event payload shapes, exact Rig APIs) live in code, not here.
