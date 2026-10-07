---
name: meant-agent
description: How a Meant agent run works end to end — provider/agent construction from the vault (ai/provider.rs), the ReAct runtime over Rig streaming (ai/agent/react.rs), the AgentEvent stream over a Tauri Channel, message persistence in commands/chat.rs, native tools, and the React ThreadProvider that renders and reconciles the run. Use before touching any of these, adding a tool or a provider, or changing an event or message shape.
---

# Meant agent run

`reference/agents.md` is the design (lifecycle, event model, snapshot + replace). Read it first. This skill maps it onto the code.

## The pipeline

```text
ThreadProvider.sendMessage (src/features/threads/thread-context.tsx)
  └─ invoke("chat", { request: { threadId, input }, channel })
       commands/chat.rs
         ├─ resolve or create thread (emits ThreadCreated)
         ├─ persist the user message
         ├─ load history → Vec<ThreadMessage>
         ├─ state.default_provider() → state.agent(provider)   (cached, built from the vault)
         ├─ RunService::run → ReActAgent::run                  (streams events)
         ├─ persist produced messages (assistant / tool_call / tool_result)
         └─ emit RunCompleted { messages: persisted rows incl. the user message }
```

## Invariants (do not break)

- **Assistant segment ids** are created at `MessageStarted` and reused as the stored row id. One run can produce several segments (text → tool call → text). `close_current_message!` closes a segment before each tool call and at the end.
- **Tool calls are matched by `tool_call_id`**, never by row id.
- **RunCompleted is authoritative**: the UI sets `messages = [...preRunSnapshot, ...event.data.messages]` and drops the live view. Anything the live view shows must be derivable from persisted rows after completion.
- **Events are ordered per run** and carry `run_id` and `thread_id`. The UI must ignore events for a thread it is no longer showing (bug tracked in `fixes.md`).
- **Errors are emitted once.** Today `react.rs`, `RunService` and the `invoke` rejection can all surface the same failure (see `fixes.md`). Target: `RunService` emits `Error`; the runtime only returns `Err`; the UI ignores the `invoke` rejection if an `Error` event already ended the run.

## Changing an event or message shape

Rust `AgentEvent` / `StoredThreadMessage` (serde: `tag = "type", content = "data"`) and `src/lib/types.ts` must change together, plus every `case` in `thread-context.tsx`. Everything on the wire is camelCase (`rename_all` on structs, `rename_all_fields` on `AgentEvent`); `ipc_payloads_are_camel_case` in `types.rs` pins it.

## Providers (`ai/provider.rs`)

- `build_agent(provider, vault)` reads the key itself; callers never handle key material.
- Each provider branch finishes its own Rig builder chain (`client.agent(model).preamble(..).default_max_turns(..).tool(..).build()`) and converges on `rig::agent::Agent`, so everything above is provider-agnostic.
- Model ids, preamble and max turns are hardcoded for now (roadmap: model selection).
- Rig 0.42 APIs differ from older examples: check docs.rs for the version in `Cargo.lock`.

## Adding a native tool

1. `src-tauri/src/ai/tools/<name>.rs` with `#[rig::tool_macro(description = "...", required(...))]` on an `async fn` returning `Result<T, ToolError>` (see `echo.rs`). Add `pub mod` in `tools/mod.rs`.
2. Register it with `.tool(...)` on **every** provider branch in `provider.rs`.
3. Decide its failure contract (see `reference/agents.md` §5): a recoverable failure should come back as a result the model can read; a fatal one returns `Err`. `is_error` is not wired yet (always `false`).
4. Tools that touch the filesystem, shell or network need an explicit permission story first (roadmap axis "Outils"): do not add one without it.
5. Test the pure part of the tool in its module.

## Frontend side (`src/features/threads/`)

- `thread-context.tsx` holds transient run state; refs hold technical state (`threadIdRef`, `activeRunRef`, `currentAssistantMessageIdRef`, `preRunMessagesRef`). Navigation is never done inside the provider: callers pass `onThreadCreated`.
- Deltas go through `useTextBuffer` (30 ms ticks) before reaching React state.
- `utils.ts::groupMessages` pairs `tool_call` and `tool_result` into one render item. Pure: keep it that way so it can be unit-tested.
- `hydrate()` must never overwrite an active run on the same thread.

## Verifying a change

Rust: `cargo test`, plus a unit test for any pure conversion you touch (`to_rig_message`, `TryFrom<StoredThreadMessage>`). End to end needs `pnpm tauri dev` with a real key: a plain answer, an answer that calls `echo`, a provider error (invalid key), and reopening the thread afterwards. Say which of these you could not run.
