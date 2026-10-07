<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# YouLearn

Learning platform: courses and programs whose visibility depends on the **groups** (tags) an admin gives each user.
pnpm + Turborepo monorepo, TypeScript everywhere. Users never sign up: admins create the accounts.

## Commands

Node >= 24, pnpm 12 (run everything from the repo root).

```sh
cp .env.example .env     # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm install
pnpm db:up               # postgres 18 + RustFS S3 storage (docker/compose.yml, reads .env)
pnpm db:migrate          # apply drizzle migrations
pnpm dev                 # web :3000 + api :3001 (turbo TUI)

pnpm check-types         # tsc in every package (web runs `next typegen` first)
pnpm test                # Vitest unit tests (api, auth, web); one package: pnpm --filter api test
pnpm --filter <pkg> exec biome check --write <paths>   # lint + format the files you touched
pnpm lint:ci             # Biome on the whole repo, read-only (the pre-push hook runs it, then check-types and test)
pnpm build
pnpm db:generate         # after editing packages/db/src/schema -> commit the new migration
pnpm --filter @youlearn/auth seed:admin   # same seed the API runs at startup
```

- Format and lint with **Biome** only (tabs, no Prettier): `pnpm format` formats the repo, and while working run `pnpm --filter <pkg> exec biome check --write <paths>` on the files you touched. `apps/web/components/ui` (shadcn-generated) is excluded from Biome on purpose; CSS uses Biome's Tailwind parser.
- Lint, format and types are clean repo-wide (generated `packages/db/drizzle/` and `components/ui` are excluded from Biome): keep it that way, an error is yours. `components/ui/spinner.tsx` carries a small local fix (spread before `strokeWidth`); re-running `shadcn add spinner --overwrite` would bring the type error back.
- **Git hooks** (Husky, installed by `pnpm install` through the `prepare` script): `pre-commit` runs `biome check --staged --write` (fixes and re-stages the staged files, blocks the commit on what it cannot fix; a partially staged file gets staged entirely), `pre-push` runs `pnpm lint:ci`, `pnpm check-types` then `pnpm test`. When a hook fails, fix the cause rather than bypassing it with `--no-verify`. **CI** (`.github/workflows/ci.yml`, GitHub Actions on pushes to `main`/`dev` and on pull requests) runs the same three checks on a clean checkout, with placeholder env values: it has no `.env`, database or storage.
- **Tests**: Vitest, colocated `*.test.ts`, only for pure logic (rules, validation, parsing). Unit tests stay hermetic: they never import `@youlearn/db`, `@youlearn/config` or `@youlearn/storage` (no database, no `.env`, no mocking of those). When logic you want to test sits in a module that does, move it into a DB-free file (see `apps/api/src/lib/course-rules.ts`, `revision-rules.ts`, `image-type.ts`; the original module re-exports or imports it; `packages/content` is DB-free by construction). Add or update tests with the rule you change. Routes and pages have no automated tests yet: verify them by exercising them (`curl` with a session cookie) and say what was not exercised.

## Layout

| Path | Role |
|---|---|
| `apps/web` | Next.js 16 App Router + shadcn (base-ui) + Tailwind 4. Conventions: `youlearn-ui` skill. |
| `apps/api` | Fastify 5. Mounts Better Auth on `/api/auth/*`, exposes `/api/me`, `/api/admin/*`, `/api/writer/*` (courses, revisions), `/api/review/*`, the learner catalog (`/api/courses`) and the course files. |
| `packages/config` | Loads the root `.env`, validates it with zod, exports `env`. |
| `packages/content` | Pure course content: the `CourseContent` v2 types and zod schema (chapters, blocks, quiz), video URL allowlist, quiz rules, `diffContent`. Depends only on `zod` and `diff`. |
| `packages/db` | Drizzle client (`pg`), schema, migrations (`drizzle/`). |
| `packages/storage` | S3 client (`@aws-sdk/client-s3`) for course files: `ensureBucket`, `putObject`, `getObject` (streamed, `Range`), `objectExists`, `moveToDeprecated`, `presignGet`/`presignPut`. Only talks to the S3 API, so RustFS (dev) is swappable for any S3. |
| `packages/events` | Event log registry (`feature.action` types, pure) and `recordEvent` (`@youlearn/events/server`). |
| `packages/auth` | Better Auth instance (+ admin plugin), browser client (`@youlearn/auth/client`), admin seed. |
| `packages/types` | Type-only: row types inferred from the schema and API response shapes. |
| `packages/typescript-config`, `packages/biome-config` | Shared configs (`node.json` for packages and API, `nextjs.json` for web). |

Dependency direction: `content` (pure leaf) and `config` <- `db` (it types the `content` jsonb with `content`) <- `events` <- `auth` <- `types` (type-only imports) <- `api` / `web`; `storage` depends only on `config` and is used by `api`. Do not create cycles.

## Work tracking (written in French)

Three files at the repo root: `roadmap.md` (the big features to come, by axis and horizon), `todo.md` (the executable plan of the feature in progress, with decisions, phases and **Vérif.** lines; its "Mode d'emploi" explains how to work it) and `backlog.md` (unscheduled ideas). Read `todo.md` before starting a feature; do not pick from the backlog unless asked. When a plan is finished, set it to "Aucun" and update the status in `roadmap.md`.

## Skills (read before working in the area)

Detailed conventions live in project skills (`.claude/skills/`), loaded when the task matches. **Invoke the matching skill before touching its area**:

| Skill | When |
|---|---|
| `youlearn-ui` | anything under `apps/web`: pages, forms, tables, dialogs, icons, page headings |
| `youlearn-api` | API routes, `packages/db` schema and migrations, events, shared types, auth rules, seeds |
| `youlearn-courses` | courses, revisions, chapters/blocks/quizzes, content diff, files and images, review links, group visibility |

## Architecture rules (always apply)

- **Packages ship TypeScript sources** (no build step): `exports` point to `src/*.ts`. `web` consumes them through `transpilePackages` in `next.config.ts` (add new packages there), `api` bundles them with tsdown (`noExternal: [/^@youlearn\//]`). A new package needs `exports`, a `tsconfig.json` extending `node.json`, and a `biome.json` extending `@youlearn/biome-config/base`.
- **Env**: one `.env` at the repo root, read only through `@youlearn/config`. Never touch `process.env` elsewhere. A new variable goes in `packages/config/src/schema.ts`, `.env.example` **and** `globalPassThroughEnv` in `turbo.json` (turbo filters the environment of tasks: without it the variable is invisible to `check-types`/`build` whenever it is not in a `.env` file, e.g. in CI); if the schema requires it, also give it a placeholder in the CI workflow. Client components may import only the pure `@youlearn/config/email-domain`, never the main entry (it validates the server env and reads the filesystem).
- **Database**: never edit an applied migration (`pnpm db:generate` creates a new one). The `group` table is an SQL reserved word: always go through drizzle for it. Import query helpers (`eq`, `and`, `sql`, ...) from `@youlearn/db`; do not add `drizzle-orm` to other packages (pnpm resolves a broken peer copy).
- **Auth**: the browser only talks to the web origin (Next rewrites `/api/*` to the API). Roles are `Role[]` through `@youlearn/auth/roles`; never compare `user.role` as a plain string. The UI never replaces a server-side permission check.
- **Events**: every notable action is recorded with `recordEvent`; a new event type also needs its labels in `apps/web/lib/events.ts`. Never put secrets in event metadata.
- **Files**: the app never deletes a stored file for good, it moves it to the deprecated bucket.

## Code style

- TypeScript strict with `noUncheckedIndexedAccess`; no `any`. Imports are sorted by Biome.
- Match the surrounding code (names, comment density). Comments explain *why*, not what.
- Keep changes scoped: do not reformat or "clean up" generated files (`components/ui`, `drizzle/`) beyond the task.
- Commits follow Conventional Commits (`feat:`, `fix:`...). Pull requests are squash-merged and their **title** becomes the commit message release-please reads, so it must be a Conventional Commit too (CI checks it). Never edit `CHANGELOG.md` or the version in `package.json`: release-please owns them. Never commit `.env`.

## Gotchas

- pnpm 12 blocks dependency build scripts: allow them in `allowBuilds` (`pnpm-workspace.yaml`), as done for `esbuild`.
- Postgres' host port comes from `POSTGRES_PORT` (5432 may already be taken); keep `DATABASE_URL` in sync.
- `.env` is read at process start: restart `dev` after changing it. Do not leave your own `tsx watch` / `next dev` processes running: ports 3000/3001 are the user's.
- `turbo` and `next` are recent majors whose behavior differs from older docs: read the docs bundled in the installed packages (see the blocks below / in `apps/web/AGENTS.md`). The same goes for `@tanstack/react-table` (v9: `useTable`, explicit features), see its `skills/` folder.
