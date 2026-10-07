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
- **Frontend:** React 19 + TypeScript + Vite, React Router, shadcn/ui, Tailwind 4
- **Backend:** Rust
- **AI:** Rig (Anthropic and OpenAI today)
- **Persistence:** SQLite (threads, messages, runs), TOML file (preferences), OS credential store (API keys)
- **Planned:** local vector store, local inference (Ollama, llama.cpp / Candle), MCP tools

## Getting started

Requirements: Node 24, pnpm 11, Rust stable, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```sh
pnpm install
pnpm tauri dev
```

On first launch Meant asks for a display name, a theme and at least one API key (Anthropic or OpenAI). Keys go to the OS credential store under the service `meant`; they can be changed later in Settings. Meant reads no environment variables.

## Development

```sh
pnpm typecheck && pnpm check && pnpm test          # frontend: types, Biome, Vitest
cd src-tauri && cargo clippy --all-targets && cargo test
```

The same checks run in the pre-push hook and in CI. Conventions for contributors and coding agents are in [AGENTS.md](AGENTS.md).

## Documentation

- [reference/ARCHITECTURE.md](reference/ARCHITECTURE.md): application boundaries (UI, IPC, Rust core, storage).
- [reference/agent-runtime.md](reference/agent-runtime.md): how an agent run executes, streams and is persisted.
- [reference/config.md](reference/config.md): preferences file and secrets boundary.
- [reference/release.md](reference/release.md): git flow, CI and how releases are cut.
- [roadmap.md](roadmap.md), [todo.md](todo.md), [backlog.md](backlog.md): planned work, current plan and ideas (in French).

## Status

Early development. Chat with streaming, tool calls, persisted threads and runs, setup and settings work; the next steps are thread management, model selection and real tools with permissions (see the roadmap).
