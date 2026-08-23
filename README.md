# Meant

**Meant** is a local-first AI workbench for building, running, and interacting with AI agents from the desktop.

## Principles

- **Local-first** — application data, threads, files, indexes, and tools remain local by default.
- **Provider agnostic** — models can run locally or through remote providers without changing the application architecture.
- **Privacy by default** — data leaves the machine only when explicitly required by a configured provider or service.
- **Agent-centric** — agents are the primary abstraction for AI interactions, with tools and models treated as composable capabilities.
- **Extensible** — native tools, MCP servers, local models, and remote providers can be added without coupling them to the UI.
- **Streaming-first** — AI responses and long-running operations are exposed incrementally for a responsive desktop experience.
- **Desktop-native** — filesystem, Git, shell, processes, and other local capabilities are first-class citizens.

## Architecture

```text
Tauri 2
   │
React / TypeScript
   │
Tauri IPC
   │
Rust Core
 ┌─┼───────────┐
 │ │           │
AI Storage   Tools
 │
Rig
 │
├── Remote Models
└── Local Models
```

The UI is responsible for presentation and interaction. The Rust core owns AI execution, persistence, and native capabilities.

## Stack

- **Desktop:** Tauri 2
- **Frontend:** React + TypeScript + Vite
- **UI:** shadcn/ui
- **Backend:** Rust
- **AI:** Rig
- **Persistence:** SQLite
- **Vector search:** local vector store
- **Local inference:** llama.cpp / Candle / Ollama
- **Tooling:** Native tools + MCP

## Status

Early development. The current focus is establishing the core agent, thread, streaming, storage, and desktop architecture.
