---
name: meant-core
description: Conventions for Meant's Rust core under src-tauri/ — adding or changing a Tauri command, AppState, error types, the SQLite ThreadRepository, the AtomicFileStore/config.toml, and the OS vault (keyring, ProviderId). Use before editing any file in src-tauri/src outside ai/ (for the agent run, use meant-agent).
---

# Meant Rust core

Read `reference/ARCHITECTURE.md` and `reference/config.md` for the why. This skill is the how.

## Adding or changing a Tauri command

1. Put it in `src-tauri/src/commands/<area>.rs` (one area per file; add `pub mod` in `commands/mod.rs`).
2. Request payloads are a `#[derive(Deserialize)] #[serde(rename_all = "camelCase")]` struct passed as a single `request` argument. Every field the UI may omit must be `Option<T>` or `#[serde(default)]`: a missing non-optional field rejects the whole call.
3. Register it in the `generate_handler![...]` list in `main.rs`.
4. Mirror it on the TS side in the same change: types in `src/lib/types.ts`, the `invoke` call in a hook under `src/hooks/` (or the feature's loader), never inline in a component.
5. Commands stay thin: validate input, call the domain (`state.threads`, `state.config_store`, `state.vault`, `state.agent(...)`), map the error. No SQL, no provider calls, no business rules in the command body.
6. A command that mutates something a cached object depends on must invalidate it (example: `set_secret` → `state.invalidate_agent(provider)`).

## Errors

- Domain modules own a `thiserror` enum (`StoreError`, `VaultError`). Implement `serde::Serialize` as `serialize_str(&self.to_string())` so the UI receives a readable message (see `storage/error.rs`).
- Messages are user-facing when they can reach the UI: say what to do ("Add a key in Settings"), never include a secret.
- The db layer still returns `Result<_, String>` and `DbError` is unused: the planned migration is in `fixes.md`. Do not add new `String` errors.
- No `unwrap()`/`expect()` outside tests and the `setup` closure.

## State (`state.rs`)

`AppState` is managed once in `main.rs::setup`. Fields are shared across concurrent commands: anything mutable needs interior synchronization (`RwLock` for the agent cache, `Mutex<Connection>` in the repository). Hand out `Arc`s rather than holding a lock across an `.await` (see `AppState::agent`).

## SQLite (`db/`)

- One connection behind a `Mutex`; every method locks, runs, returns owned values.
- Schema changes are migrations: add `src-tauri/src/db/migrations/NNNN_name.sql` and append it to `MIGRATIONS` in `db/migrations.rs` (`PRAGMA user_version` = migrations applied, each run in a transaction). Never edit or reorder an applied migration. Add a test in `migrations.rs` for any data transformation.
- Repository tests use `ThreadRepository::from_connection(Connection::open_in_memory()?)`.
- Message `role` is one of `user | assistant | tool_call | tool_result`; tool payloads are JSON strings in `content`. Converting rows to agent messages goes through `TryFrom<StoredThreadMessage> for ThreadMessage` (`ai/agent/types.rs`).
- Timestamps are Unix seconds (`chrono::Utc::now().timestamp()`); the UI multiplies by 1000.

## Config (`config/`, `storage/`)

- `AtomicFileStore<T, C>` is generic: reuse it for any new local file-backed data rather than writing files by hand. Writes are temp-file + rename.
- `load()` → `Ok(None)` means first run; `Err(Decode)` means a corrupted file. Never collapse the two.
- A new preference: field on `AppConfig` with a `#[serde(default = ...)]`, a matching `Option` on `UpdateConfigRequest`, the TS `AppConfig` type, and the settings form. Keep `Default` consistent with the serde defaults.
- The presence of `config.toml` marks setup as done: the setup flow writes keys first, config last.

## Vault (`vault/`)

- Only `ProviderId` variants may be written to the vault (enum, not a free string). A new provider means: variant, `secret_key`, `label`, `accepts`, `ProviderId::ALL`, `ai/provider.rs` branch, and `src/config/providers.ts`.
- `get_secret` maps `NoEntry` to `Ok(None)`; `delete_secret` is idempotent.
- No command returns key material. `list_secrets` returns presence only.
- Tests use `vault::mock::InMemoryStore`; never touch the real keyring in tests.

## Checks

`cargo check`, `cargo clippy --all-targets`, `cargo test` from `src-tauri/`. Add or update a unit test with the rule you change.
