# Meant

Local-first AI workbench: a Tauri 2 desktop app where a Rust core runs AI agents (Rig, ReAct loop, tools) and a React UI renders threads with streaming. Keys live in the OS vault, preferences in a TOML file, threads in SQLite. Nothing leaves the machine except calls to the configured model provider.

The local checkout folder may be named `hearth`; the product, package, bundle id (`com.bredda.meant`), keyring service (`meant`) and database (`meant.db`) are all **Meant**.

## Commands

Node 24, pnpm 11, Rust stable (edition 2021). Frontend commands run from the repo root, Rust ones from `src-tauri/`.

```sh
pnpm install
pnpm tauri dev            # full app: Vite on :1420 + Rust core (needs an API key, entered on first launch)
pnpm dev                  # frontend only in a browser: every `invoke` fails, useful for pure layout work

pnpm typecheck            # tsc --noEmit
pnpm check                # Biome via ultracite, read-only
pnpm fix                  # Biome via ultracite, writes
pnpm test                 # Vitest: pure frontend logic (colocated *.test.ts, no DOM)

cd src-tauri
cargo check
cargo test                # unit tests; hermetic, no keyring or network
cargo clippy --all-targets
cargo fmt --check
```

- **Before handing work back**, run `pnpm typecheck`, `pnpm check`, `pnpm test`, `cargo clippy --all-targets` and `cargo test`, and say which ones fail. They all pass on `main`: a failure is yours to fix or report.
- **Formatting**: Biome only for TS/JSON/CSS (no Prettier); rustfmt for Rust (`src-tauri/rustfmt.toml`). A Claude Code hook (`.claude/hooks/format-file.mjs`) formats every file you write with the same tools. `src/components/ui` (shadcn-generated) is excluded from Biome on purpose.
- **Git hooks** (Husky): `pre-commit` runs lint-staged (ultracite fix on staged files); `pre-push` runs typecheck, Biome, Vitest, clippy and cargo test. Fix the cause of a failing hook, never `--no-verify`.
- **CI** (`.github/workflows/ci.yml`, push to `main` and pull requests) runs the same checks plus `cargo fmt --check` and `pnpm build` on Ubuntu.
- **Tests**: Rust tests live in `#[cfg(test)]` modules next to the code and stay hermetic (use `vault::mock::InMemoryStore`, `tempfile`, in-memory SQLite; never the real keyring or a provider). Frontend tests use Vitest (`pnpm test`), colocated `*.test.ts`, for pure logic only (no DOM, no `invoke`). UI flows need the real app: say what you could not exercise.

## Layout

| Path | Role |
|---|---|
| `src-tauri/src/main.rs` | Builder: plugins, `AppState`, the `generate_handler!` list of commands. |
| `src-tauri/src/state.rs` | `AppState`: thread repository, config store, vault, per-provider agent cache. |
| `src-tauri/src/commands/` | One file per Tauri command group (`chat`, threads, `setup`, `secrets`, `update_config`). Thin: validate, call domain, map errors. |
| `src-tauri/src/ai/` | `provider.rs` builds a Rig agent per provider from the vault; `agent/` holds the runtime trait, the ReAct runtime and the event/message types; `tools/` native tools. |
| `src-tauri/src/runs/` | `RunService`: wraps an `AgentRuntime`, owns error emission for a run. |
| `src-tauri/src/db/` | `ThreadRepository` over rusqlite (threads, messages). |
| `src-tauri/src/storage/` | `AtomicFileStore<T, Codec>`: generic atomic file persistence (TOML today). |
| `src-tauri/src/config/` | `AppConfig` (non-secret preferences) stored as `config.toml` in the app data dir. |
| `src-tauri/src/vault/` | `SecretStore` trait, `KeyringStore` (OS vault), `ProviderId` and key validation. |
| `src/app/` | Entry (`index.tsx`: bootstrap gate), providers, router, lazy routes (`routes/*.tsx` export `Component`). |
| `src/features/` | Feature folders: `threads` (ThreadProvider, streaming, rendering), `settings`, `splashscreen` (first-run setup), `errors`. |
| `src/hooks/`, `src/stores/` | IPC hooks (`use-bootstrap`, `use-secrets`, `use-config-update`) and Zustand stores (config cache). |
| `src/lib/types.ts` | TS mirror of the IPC types (events, messages, config). Keep in sync with Rust by hand. |
| `src/components/ui/` | shadcn components (generated, `radix-ui` + Tailwind 4). |
| `reference/` | Architecture docs: `ARCHITECTURE.md`, `agent-runtime.md` (agent run), `config.md`. Read before changing a boundary. |

## Work tracking (written in French)

Four files at the repo root:

- `roadmap.md`: the big features to come, by axis and horizon.
- `todo.md`: the executable plan of the feature in progress (decisions, phases, **Vérif.** lines). Its "Mode d'emploi" explains how to work it. Read it before starting.
- `backlog.md`: unscheduled ideas, features and fixes. Do not pick from it unless asked.
- `fixes.md`: the review of the existing code and the planned corrections, to be applied before new features. Each correction is validated by the user before it is implemented.

When a plan is finished, set `todo.md` to "Aucun" and update the status in `roadmap.md`.

## Skills (read before working in the area)

| Skill | When |
|---|---|
| `meant-core` | anything under `src-tauri/`: commands, `AppState`, errors, SQLite, config store, vault |
| `meant-agent` | the agent run: providers, ReAct runtime, streaming events, tools, message persistence and the UI reconciliation |
| `meant-ui` | anything under `src/`: routes, features, forms, shadcn components, IPC calls, theme |

## Architecture rules (always apply)

- **Rust decides, React renders.** AI execution, persistence and native capabilities live in Rust. React never holds domain logic, never talks to a provider, never persists anything itself.
- **Secrets never cross IPC.** Keys go UI → `set_secret` → vault, one way. No command returns key material; `AppConfig` never gets a credential field; never log a key. Key format checks exist in both `src/config/providers.ts` and `vault/secrets.rs`: change both.
- **Persisted state is authoritative.** The UI's streaming view is disposable: `RunCompleted` replaces it with the persisted messages (snapshot + replace, see `reference/agent-runtime.md`). Do not patch live state to "match" the database.
- **One error emission per failure.** A run failure reaches the UI once: `RunService` emits the `Error` event, runtimes only return `Err`, and the UI ignores the matching `invoke` rejection.
- **IPC contract changes are two-sided.** A new or changed command, event or payload means: Rust type, `main.rs` handler list, `src/lib/types.ts`, and the calling hook, in the same change.
- **Local-first.** No network call other than the configured model provider: no CDN assets, remote avatars, telemetry or update checks without an explicit decision.

## Code style

- Rust: `thiserror` enums for errors that cross a boundary, serialized to a string for the UI; no `unwrap()`/`expect()` outside tests and startup. TS: strict, no `any`, imports sorted by Biome.
- Match the surrounding code (names, comment density). Comments explain *why*. Code, comments and UI strings are in English.
- Keep changes scoped: do not reformat or "clean up" generated files (`src/components/ui`, `src-tauri/gen`) beyond the task.
- Commits follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`). The user commits and merges; do not commit unless asked. Never commit `.env`.

## Gotchas

- `rig` (0.42) moves fast and its API differs from older docs and from training data: check the installed version in `src-tauri/Cargo.lock` and its docs on docs.rs before using an API. Same for Tauri 2.11, React Router 7, Vite 8, TypeScript 6, Biome 2.
- `.gitattributes` forces LF. On Windows with `core.autocrlf=true`, a file created outside git can still be CRLF, which Biome reports as a format error: `pnpm fix` corrects it.
- Tauri command arguments deserialize strictly: a non-`Option` field missing from the JS payload makes the whole `invoke` fail with "missing field".
- The keyring is real in `pnpm tauri dev`: keys saved there persist in the OS vault under service `meant`.
- `.env` holds local secrets: never read or print it.
