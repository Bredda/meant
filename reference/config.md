# Configuration Architecture

This document describes how Meant persists and exposes local application configuration: where it lives on disk, how it is read and updated, and how it reaches the UI. It excludes secrets (API keys, credentials), which are handled separately by the vault layer — see [Section 4](#4-secrets-boundary).

It complements [ARCHITECTURE.md](./ARCHITECTURE.md), which covers the wider application boundaries (Tauri, storage, UI).

---

## 1. Overview

Configuration in Meant follows the same local-first contract as the rest of the application: every non-sensitive setting is a plain, human-readable file on disk, never an opaque database. The config layer is responsible for:

- Persisting general application preferences (theme, and future non-secret settings) as a single TOML file.
- Loading that file once at startup and notifying the UI of the result.
- Applying partial updates from the UI (a single changed setting) without requiring the caller to know the shape of the rest of the config.
- Providing a storage mechanism generic enough to be reused for other locally-persisted data (tool permissions, usage records) without duplicating read/write logic.

```text
tauri::Builder.setup()
        │
        ├── resolve app_data_dir
        ├── ConfigStore::load()
        │
        ├── Ok(Some(config)) → emit "config-loaded"
        ├── Ok(None)         → emit "config-missing"   (first-run)
        └── Err(err)         → emit "config-error"
        │
        ▼
   React: useConfigBootstrap()
        │
        ▼
   useConfigStore (Zustand) ── read by any component, no prop drilling
```

---

## 2. Storage Layer

Configuration persistence is built on a generic, reusable primitive: `AtomicFileStore<T, C>`, parameterized over the data type `T` and a serialization `Codec` `C` (currently TOML only).

**Design decision:** the storage mechanism (resolve path, read, decode, encode, write) is factored out from the data it stores. `AppConfig` is just a struct handed to `AtomicFileStore<AppConfig, TomlCodec>` — the store itself has no knowledge of what a "config" is. This is what lets the same primitive back future non-config data (tool permissions, cost records) without touching this layer.

Writes are atomic: the encoded value is written to a temp file, then renamed over the target path. This guarantees the on-disk file is never left half-written if the app crashes mid-save — the caller always finds either the previous valid file or the new one, never a corrupted partial file.

Reads distinguish three outcomes, surfaced as `Result<Option<T>, StoreError>`:

- `Ok(Some(value))` — a valid, existing config.
- `Ok(None)` — no file exists yet (first run).
- `Err(StoreError::Decode { .. })` — a file exists but failed to parse (corrupted or hand-edited into an invalid state).

This three-way distinction is deliberate: collapsing "missing" and "corrupted" into a single case would make a corrupted file silently re-trigger first-run setup instead of surfacing a real error to the user.

---

## 3. Update Model

The UI sends **partial** updates — e.g. "just the theme changed" — never a full config object. The store exposes an `update` method that performs a read-modify-write cycle internally, so callers never have to load the current config themselves before mutating it:

```rust
store.update(move |config| {
    if let Some(theme) = request.theme {
        config.theme = theme;
    }
})
```

If no file exists yet, `update` starts from `AppConfig::default()` rather than failing — a partial update can itself initialize the config.

**Known limitation:** this read-modify-write is not protected against two concurrent updates racing each other. For a single-user desktop app with user-triggered config changes, the practical risk is negligible. If concurrent update paths appear later (e.g. multiple async tasks touching config independently), the store would need to be wrapped in a `Mutex` at the Tauri state level to serialize access.

---

## 4. Secrets Boundary

Config (this document) and secrets (vault) are deliberately separate systems with separate storage backends:

| | Config | Secrets |
|---|---|---|
| Storage | TOML file, app-data dir | OS-native credential store (Keychain / Credential Manager / Secret Service) |
| Access | `AtomicFileStore` | `keyring`-backed wrapper |
| Failure mode | first-run / corrupted-file handling | hard fail at startup, no fallback |

No secret value is ever written through the config store, and the config `AppConfig` struct never gains a field intended to hold a credential. This boundary is enforced by convention at the call site (BYOK settings write only through the vault wrapper), not by a type-level guarantee.

---

## 5. Frontend Integration

The config store is read into a dedicated Zustand store (`useConfigStore`), scoped to config only — mirroring the backend's separation of concerns (a future `useVaultStore`, `useCostStore` would follow the same pattern rather than a single monolithic app store).

A single bootstrap hook, mounted once near the app root, owns the Tauri event subscriptions (`config-loaded` / `config-missing` / `config-error`) and pushes results into the store via `getState()`. Components elsewhere in the tree read only the slice they need (`useConfigStore(s => s.config?.theme)`), so a config change only re-renders components actually depending on the changed field.

The Zustand store is a **cache of what the backend last emitted**, not a source of truth in its own right — the backend file remains authoritative.

---

## 6. Current Status & Open Questions

- Only `theme` exists as a config field today; the update model (Section 3) is designed to absorb additional fields (e.g. language) without changing its shape.
- No concurrency guard exists yet on `update` (see Section 3) — acceptable for current single-writer usage, revisit if that assumption changes.
- The vault access layer (Section 4) is a separate, not-yet-fully-documented boundary — see the corresponding backlog issue for its own architecture notes once implemented.