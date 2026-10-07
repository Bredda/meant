---
name: meant-ui
description: Conventions for Meant's React frontend under src/ — React Router 7 lazy routes, feature folders, shadcn/ui (radix + Tailwind 4) components, TanStack Form + zod forms, Zustand stores, IPC calls through hooks, theme handling and the bootstrap/splash flow. Use before creating or editing pages, forms, components, hooks or stores.
---

# Meant UI

React decides what the user sees; Rust decides what the app does. No domain logic, persistence or provider calls in components.

## Structure

- `src/app/index.tsx`: bootstrap gate. `useBootstrap` checks the vault, then loads `config.toml`; until `done` it renders `SplashScreen` (loader, error, or first-run `SplashForm`). The router only mounts after bootstrap.
- `src/app/router.tsx`: one `createBrowserRouter`. Routes are lazy: each `src/app/routes/<page>.tsx` exports `Component` (and a named page component). Data for a route comes from a `loader` calling `invoke` (see `features/threads/thread-loader.ts`), not from `useEffect`.
- `src/features/<feature>/`: components, context, loaders and pure utils of one feature. Shared building blocks go in `src/components/`; shadcn primitives in `src/components/ui/`.
- `src/hooks/`: one hook per IPC concern (`use-secrets`, `use-config-update`, `use-bootstrap`). Components never call `invoke` directly.
- `src/stores/`: Zustand, one store per backend concern (`useConfigStore`). A store is a cache of what Rust last returned, never a source of truth: write through the backend, then store its response.
- `src/lib/types.ts`: hand-written mirror of the IPC types. Change it with the Rust type.

## Components

- Add shadcn components with `pnpm dlx shadcn@latest add <name>` (config in `components.json`). `src/components/ui` is excluded from Biome; keep local edits there minimal and note them here. Current local edits (re-running `shadcn add <name> --overwrite` would drop them):
  - `spinner.tsx`: props typed as `ComponentProps<typeof RiLoaderLine>` instead of `ComponentProps<"svg">` (Remixicon forbids `children`, `tsc` fails otherwise).
  - `sonner.tsx`: `useTheme` from `@/components/theme-provider` instead of `next-themes` (not installed).
- Icons: `lucide-react` for UI icons, `@remixicon/react` for brand logos (providers). Do not add a third icon set.
- Styling: Tailwind 4 utilities and the theme tokens in `src/app/global.css` (`bg-background`, `text-muted-foreground`, ...). No hardcoded palette colors (`bg-red-50`, `text-gray-900`): they break dark mode.
- Navigation: `useNavigate` / `NavLink` / `useLocation`, never `window.location`.
- No remote assets (images, fonts, avatars from URLs): the app is local-first.
- UI strings are in English.

## Forms

TanStack Form (`@tanstack/react-form`) with a zod schema from `src/lib/schemas.ts` as validator, rendered with the shadcn `Field*` components (see `features/settings/preferences.tsx`). Validation in the form is a convenience; Rust re-validates (keys in `vault/secrets.rs`). Reuse schemas rather than redefining a rule (the username rule is duplicated today, see `fixes.md`). Show backend errors in an `Alert` or `FieldError`, successes with `toast` (sonner).

## Theme

`ThemeProvider` applies `light | dark | system` to `<html>` and follows the OS when `system`. It reads the persisted theme from `useConfigStore`; `applyTheme(theme, save)` previews without saving unless `save` is true.

## Threads

The streaming state machine lives in `features/threads/thread-context.tsx`: read the `meant-agent` skill before touching it.

## Checks

`pnpm typecheck` and `pnpm check` (run `pnpm fix` to apply Biome fixes). There is no frontend test runner yet. A UI change is only verified in `pnpm tauri dev`: say what you exercised and what you did not.
