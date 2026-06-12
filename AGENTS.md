# AGENTS.md

## Cursor Cloud specific instructions

KitchenOS is a pnpm (v10) workspace monorepo. Products live under `artifacts/` and shared
libraries under `lib/`. The canonical architecture/feature overview is in `replit.md`.
This section captures only the non-obvious setup/run caveats; standard commands live in
each package's `package.json` and in the `.replit-artifact/artifact.toml` files.

### Toolchain / package manager
- Use **pnpm 10.x** (provided via corepack; the repo was validated on `pnpm@10.33.3`).
  Do **not** upgrade to pnpm 11 (e.g. via `corepack enable` pulling its bundled default):
  pnpm 11 treats the "Ignored build scripts" notice as a hard failure (exit 1) and rewrites
  `node_modules` in a way that triggers a TTY purge prompt on the next pnpm-10 run.
- `pnpm install` prints a harmless warning that build scripts for `@clerk/shared`,
  `browser-tabs-lock`, and `core-js` were ignored — this is expected and safe. The build
  script that matters (`esbuild`, used to bundle the API server) is allowlisted via
  `onlyBuiltDependencies` and does run.
- Node: the project targets Node 24 but runs fine on the VM's default Node 22.

### Runtime prerequisites (needed before starting the API server)
The API server eagerly throws at import if these are unset, so they must be exported in
the shell that runs it (and for `pnpm --filter db push`):
- `DATABASE_URL` — PostgreSQL. There is no managed DB on the VM (the repo normally relies
  on Replit's `postgresql-16` module). Start a local one and create the DB, e.g.:
  `sudo pg_ctlcluster 16 main start` then create role/db `kitchenos` and use
  `postgresql://kitchenos:kitchenos@127.0.0.1:5432/kitchenos`. If Postgres is not installed:
  `sudo apt-get install -y postgresql postgresql-contrib`.
- `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` — required for boot.
  A placeholder key lets the server start (non-AI endpoints work); a real key is needed for
  AI features (Kios, menu/recipe generation, vision).
- `CLERK_SECRET_KEY_PROD` (or `CLERK_SECRET_KEY`) and `CLERK_PUBLISHABLE_KEY_PROD` —
  the global Clerk middleware throws if the secret key is missing, so even `/api/healthz`
  needs it. Working values are committed in `.replit` under `[userenv]`.
- After env is set, push the schema once: `pnpm --filter db push`.

The Vite apps (`website`, `preorder`, `mockup-sandbox`) **throw on startup unless `PORT`
and `BASE_PATH` are set**.

### Services and how to run them (dev)
Each artifact's run command is in its `.replit-artifact/artifact.toml` (`[services.development] run`).
Run them with the env above sourced:
| Service | Command | Port | BASE_PATH |
|---|---|---|---|
| API server (Express) | `pnpm --filter @workspace/api-server run dev` | 8080 | — |
| Mobile (Expo web — core product) | `pnpm --filter @workspace/mobile run dev` | 18115 | `/app/` |
| Pre-order guest web (Vite) | `pnpm --filter @workspace/preorder run dev` | 25604 | `/preorder/` |
| Marketing website (Vite) | `pnpm --filter @workspace/website run dev` | 19161 | `/` |

- The API server `dev` script bundles with esbuild then runs `node dist/index.mjs`
  (it is not a watcher; restart after server-side changes).
- **Same-origin routing gotcha:** the web/mobile frontends call the API via **relative
  `/api/...` paths** and there is **no Vite dev proxy**. In production the Replit
  "application router" serves everything on one origin. Locally, running each app on its own
  port means its `/api` calls do **not** reach the API server. To exercise frontend→API flows
  locally, put a reverse proxy in front that routes `/api/*` → `:8080` and everything else →
  the app's Vite port (single origin), or set a base URL for Expo via `setBaseUrl()`.

### Lint / test / typecheck / build
- There is **no test runner and no lint script** in this repo. The only code-quality tool is
  Prettier (no `format`/`lint` npm script). The verification commands are
  `pnpm typecheck` and `pnpm build` (build runs typecheck first).
- `pnpm typecheck` currently **fails on pre-existing TypeScript errors** in vendored shadcn/ui
  components (`calendar.tsx`, `spinner.tsx`, `button-group.tsx`) under `preorder`, `website`,
  and `mockup-sandbox`, plus `scripts/src/extract-koechenord-recipes.ts`. The core product
  packages **`@workspace/api-server` and `@workspace/mobile` typecheck cleanly**, and `lib/`
  builds (`pnpm typecheck:libs`). These are runtime-irrelevant (Vite/esbuild do not typecheck)
  — do not "fix" them as part of unrelated work, and per repo rules do not modify
  `artifacts/mockup-sandbox/`.
