# Technical Architecture

## 1. Target Architecture

Meant is a **local-first AI workbench**. The desktop application runs primarily on the local machine; external providers are used only when explicitly configured for model inference or other remote capabilities.

```text
                         Tauri 2
                            │
                    React / TypeScript
                            │
                       Tauri IPC
                            │
                   ┌────────▼────────┐
                   │    Rust Core    │
                   └────────┬────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
         Agent            Storage            Tools
          │                 │                 │
          │           ┌─────┴─────┐      ┌───┴────┐
          │           │           │      │        │
          │         SQLite     Vector   Native    MCP
          │                     Store     │        │
          │                              Git     Servers
          │                              Shell
          │
    See agent-runtime.md
    for the agent
    execution model
```

### Core principles

- **Local-first**: application state, threads, files, indexes and tools remain local by default.
- **Rust as the backend boundary**: AI orchestration, persistence and native capabilities live outside the webview.
- **React as the presentation layer**: UI state and interaction logic remain in TypeScript.
- **Provider agnostic**: the agent layer should not depend directly on a specific model provider.
- **Streaming by default**: long-running AI operations expose incremental events to the UI.
- **Composable tools**: native tools and MCP tools share a common agent-facing abstraction.
- **Persisted state is authoritative**: UI state is an in-memory representation of local persisted data.

---

# 2. Tauri / Rust Core

The Rust side is the application's **domain and execution layer**.

## 2.1 IPC

Tauri IPC is the boundary between React and Rust.

Responsibilities:

- Commands for request/response operations.
- Channels/events for streaming operations.
- Serialization of domain objects crossing the boundary.
- No AI or persistence logic in the React layer.

Typical flow:

```text
React
  │
  │ invoke / Channel
  ▼
Tauri Command
  │
  ▼
Rust Domain Service
  │
  ├── Agent
  ├── Storage
  └── Tools
```

---

## 2.2 Agent Layer

The agent layer is responsible for turning a conversation into a model run: prompting, tool execution, and streaming the result back to the UI.

This layer is documented separately in **[agent-runtime.md](./agent-runtime.md)**, which covers the run lifecycle, the streaming event model, and how tool calls are executed and surfaced.

At the architecture level, the important boundary is:

```text
Agent
 │
 ├── Model
 │    ├── Anthropic
 │    ├── OpenAI
 │    └── Local provider
 │
 └── Tools
      ├── Native
      └── MCP
```

The application depends on **agent-level abstractions**, not provider-specific APIs, wherever possible.

---

## 2.3 Storage

Storage is local and persistent.

### Relational state

SQLite is the primary store for:

- Threads
- Messages
- Runs
- Configuration
- Metadata
- Tool definitions
- Application state

### Vector state

Vector storage is used for:

- Embeddings
- Semantic search
- Document indexing
- Retrieval

The vector layer should remain replaceable, with SQLite/LanceDB as initial candidates.

---

## 2.4 Local Models

Local inference is deliberately isolated from the agent layer.

Potential runtimes:

- `llama.cpp`
- `Candle`
- Ollama

The application should be able to treat local and remote models through the same conceptual model interface.

```text
Agent
  │
  └── Model
       ├── Remote provider
       └── Local runtime
```

---

## 2.5 Tools

Tools are capabilities exposed to agents.

### Native tools

Examples:

- Filesystem
- Git
- Shell
- Process execution
- Application-specific operations

### MCP

MCP provides an integration boundary for external tool servers.

The architecture should avoid making MCP-specific concepts leak into the UI or core agent logic.

```text
Agent
 │
 └── Tool abstraction
       ├── Native tool
       └── MCP tool
```

Tool execution details (error handling, native tool authoring) are covered in [agent-runtime.md](./agent-runtime.md).

---

# 3. React / TypeScript UI

React is responsible for **presentation and interaction**, not domain execution.

## 3.1 Routing

React Router defines the application navigation model.

```text
/threads
    Thread list

/threads/new
    New thread composer

/threads/:id
    Existing thread
```

The route is the source of truth for the currently displayed thread.

---

## 3.2 Thread State

A `ThreadProvider` manages the active thread's transient UI state:

- Current thread
- Messages
- Streaming state
- Input/run state
- Optimistic assistant message
- Stream buffering

It does **not** own navigation or persistence.

```text
Router
   │
   ▼
Thread route
   │
   ▼
ThreadProvider
   │
   ├── persisted thread
   ├── messages
   └── active stream
```

---

## 3.3 Data Loading

Persisted data is loaded through route loaders / IPC.

The general principle is:

```text
Rust Storage
     │
     ▼
Route Loader
     │
     ▼
React UI
```

The provider can then hydrate its transient state from the loaded data.

---

## 3.4 Streaming

AI execution is event-driven. The Rust agent emits a stream of typed events over a Tauri channel; React consumes them to build up a live view of the run, then reconciles with the persisted result once the run completes.

```text
Rust Agent
    │
    ├── ThreadCreated
    ├── RunStarted
    ├── MessageStarted / MessageDelta* / MessageCompleted
    ├── ToolCallStarted / ToolCallCompleted
    ├── RunCompleted ──────► React
    └── Error ─────────────► React
```

The full event model and the message-identity strategy that lets the UI reconcile live state with persisted state are documented in [agent-runtime.md](./agent-runtime.md).

The UI buffers deltas before rendering when necessary to avoid excessive visual updates.

---

## 3.5 UI Design Principles

- Keep domain logic out of components.
- Keep navigation out of the agent/provider layer.
- Prefer route state for navigation state.
- Prefer persisted Rust state as the source of truth.
- Keep streaming state ephemeral.
- Avoid duplicating thread/message state across sidebar, routes and providers.

---

# 4. Architectural Direction

The architecture should evolve around three clear boundaries:

```text
              UI
               │
          Tauri IPC
               │
        ┌──────▼──────┐
        │ Rust Domain │
        └──────┬──────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
   Agent    Storage     Tools
```

**React decides what the user sees. Rust decides what the application does. Storage decides what persists. The agent decides how AI work is executed.**

See [agent-runtime.md](./agent-runtime.md) for how the agent boundary itself is structured.