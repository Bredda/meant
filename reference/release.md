# Git flow and releases

How code gets from a branch to a published version. One developer, so the flow is deliberately small.

```text
branch (one plan / phase of todo.md)
   │  atomic Conventional Commits
   │  pre-commit: format + lint staged files
   │  commit-msg: commitlint
   │  pre-push:   typecheck, Biome, cargo fmt, clippy
   ▼
pull request ──► CI "checks" (commit messages, types, Biome, tests, build, rustfmt, clippy, cargo test)
   │  merge commit or rebase (not squash)
   ▼
main ──► release-please keeps a "release PR" up to date (CHANGELOG.md + version bump)
   │  merging the release PR is the manual step that cuts a release
   ▼
tag vX.Y.Z + GitHub release ──► installers built and attached (Linux, Windows, macOS arm64 and x64)
```

## Branches and commits

- `main` is always releasable and only changes through a pull request.
- One branch per plan, or per phase of a long plan (see `todo.md`): branches that live for weeks drift from `main` and produce pull requests nobody can review. Name them `<type>/<topic>` (`feat/thread-management`, `fix/review-fixes`).
- Commits are atomic and follow [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `perf`, `refactor`, `docs`, `chore`, `style`, `test`, `ci`, `build`. Release tooling reads them, so `commitlint` rejects other formats locally (`commit-msg` hook) and in CI.
- Merge pull requests with a **merge commit or rebase**. A squash replaces the atomic commits by one, and the changelog then has one line per pull request.
- Never edit `CHANGELOG.md`, the version in `package.json` or in `src-tauri/Cargo.toml` by hand: the release PR owns them.

## What triggers what

| Where | What runs | Defined in |
|---|---|---|
| `git commit` | lint-staged (Biome fix on staged files), commitlint | `.husky/` |
| `git push` | `pnpm typecheck`, `pnpm check`, `cargo fmt --check`, `cargo clippy` | `.husky/pre-push` |
| Pull request, push to `main` | commit messages (PR only), types, Biome, Vitest, frontend build, rustfmt, clippy, cargo test | `.github/workflows/ci.yml` |
| Push to `main`, manual "Run workflow" | release-please opens or updates the release PR | `.github/workflows/release.yml` |
| Release PR merged | tag, GitHub release, installer builds | `.github/workflows/release.yml` |

Hooks are a convenience (they can be bypassed); CI is the gate.

## Versioning

Pre-1.0: a breaking change bumps the **minor** (`bump-minor-pre-major`), `feat` bumps the minor, `fix` the patch. The version lives in `package.json` and `src-tauri/Cargo.toml` (plus `Cargo.lock`); `tauri.conf.json` has none, so Tauri uses Cargo's. release-please updates all three files, configured in `release-please-config.json`; the last released version is in `.release-please-manifest.json`.

Changelog sections: Features, Bug Fixes, Performance, Refactoring. `docs`, `chore`, `style`, `test`, `ci` and `build` commits are hidden.

## Cutting a release

1. Merge feature pull requests into `main`. The release PR (`chore(main): release X.Y.Z`) appears and updates itself.
2. When you want to release: check the changelog in the release PR, let its CI pass, merge it.
3. The workflow tags `vX.Y.Z`, creates the GitHub release, then the `Build` jobs attach the installers (`.deb`, `.rpm`, `.AppImage`, `.msi`, `.exe`, `.dmg`).

"Run workflow" on the Release workflow does the same as a push to `main`: use it if the release PR is missing or stale.

## One-time GitHub setup

Done in the repository settings, not in code:

1. **Release PR token.** A pull request opened with the default `GITHUB_TOKEN` does not trigger other workflows, so the release PR would never get its CI. Create a fine-grained personal access token for this repository (permissions: *Contents* and *Pull requests*, read and write) and store it as the Actions secret `RELEASE_PLEASE_TOKEN`. Until it exists the workflow falls back to `GITHUB_TOKEN`, which also needs *Settings → Actions → General → Allow GitHub Actions to create and approve pull requests*.
2. **Protect `main`** (a ruleset): require a pull request, require the status check `checks`, block force pushes. No approval count is needed for a solo project. Do this after step 1, otherwise the release PR can never satisfy the required check.
3. **Merge methods** (*Settings → General*): allow merge commits and rebase merges, disable squash merging.

## Not done yet

- **Signing.** Installers are unsigned: Windows SmartScreen and macOS Gatekeeper warn on first launch. Signing (Windows certificate, Apple Developer ID and notarization) is planned together with automatic updates (roadmap axis 10), which also need an updater key pair.
- **The build job has not run yet.** It only runs on a real release, so the first one is the test: if `tauri-action` does not attach to the release created by release-please, check its `tagName` and `releaseName` inputs first.
