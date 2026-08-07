# @simon/workspace-env

Config-driven Conductor workspace **setup / run** for a fleet of repos. One shared
implementation of the mechanics (1Password `op inject` bootstrap, dependency
install, env validation, dev-server launch with free-port discovery); each repo
carries only a declarative `env/workspace.config.yaml`.

The goal is to stop the drift: the setup/run scripts across projects started from a
common ancestor and diverged badly. Here the logic lives once, versioned; a fix is a
version bump, not a re-edit of N repos.

## Install (tag-pinned git dependency — no registry)

```jsonc
// package.json
"devDependencies": {
  "@simon/workspace-env": "github:simonhac/workspace-env#v0.1.0"
}
```

Consumed as raw TypeScript by `tsx`/`bun` — no build step.

## The wrappers (byte-identical in every repo)

Use the `.mts` extension — it's always ESM, so the wrappers work even in repos that
are not `"type": "module"` (most app repos), where a plain `.ts` would be transformed
as CJS and reject the top-level `await`. The `-S npx --yes tsx` shebang matters too: in
a fresh worktree `tsx` isn't installed yet, and plain `npx tsx` hangs on an interactive
install prompt — `--yes` auto-accepts it.

```ts
// env/setup.mts
#!/usr/bin/env -S npx --yes tsx
import { runSetupFromConfig } from "@simon/workspace-env";
process.exit(await runSetupFromConfig(import.meta.url));
```

```ts
// env/run.mts
#!/usr/bin/env -S npx --yes tsx
import { runDevFromConfig } from "@simon/workspace-env";
await runDevFromConfig(import.meta.url);
```

Wire them in `.conductor/settings.toml` (committed). The `setup` command installs
deps first (a fresh workspace has no `node_modules` yet, so this is what fetches
`@simon/workspace-env` before the wrapper imports it); use the project's package
manager here (`pnpm install`, `bun install`, `npm install --legacy-peer-deps`, …):

```toml
[scripts]
setup = "npm install && npx --yes tsx env/setup.mts"
run   = "npx --yes tsx env/run.mts"
run_mode = "concurrent"
```

## The only per-project file: `env/workspace.config.yaml`

```yaml
project: example-app
setup:
  - vercelLink
  - installDeps
  - opInjectEnv
  - validateEnv
  - verify
run:
  command: npm run dev
  port: { from: 3000, span: 5 }   # findFreePort scans 3000..3004, first free wins
```

A phase entry is a bare id (`verify`) or an object with options
(`{ phase: installDeps, args: ["--legacy-peer-deps"] }`).

### Built-in phases

| id | what it does | key options |
|---|---|---|
| `installDeps` | install deps for one or more apps | `apps: [{ dir, manager: npm\|pnpm\|bun, args }]`, or top-level `manager`/`args`/`dir` |
| `opInjectEnv` | `op inject .env.tpl → .env.local` from 1Password; Keychain-SA auth with NETWORK-vs-AUTH diagnosis + symlink-safety | `keychainItem` (default `op-sa-<project>-dev`), `account` (default `my.1password.com`), `tpl`, `target` |
| `vercelLink` | ensure `.vercel/project.json` | `project` (default `<project>`), `cwd` |
| `validateEnv` | run the project's own `@t3-oss/env` schema | `schema` (path to a module that calls `createEnv`), `cwd` |
| `verify` | node_modules present | `cwd` |

### Project-local phases (bespoke logic stays in-repo)

```yaml
setup:
  - { phase: local, module: ./phases.local.ts, export: venvSymlink }
```

The referenced export is a `Phase` or a `(opts) => Phase` factory — same interface as
the built-ins. Used for clara's venv/data-bundle, ootnaboot's Expo launcher, etc.

### `run.port`

`{ from, span }` or `{ from, to }`. `findFreePort` bind-tests upward from `from`, so a
project's primary worktree lands on its canonical port (for password-manager autofill —
set the 1Password login to "exact domain" host:port matching). `CONDUCTOR_PORT` is
intentionally not used, so ports stay predictable.

## Design notes

- **Env vars are the project's business.** The project owns `.env.tpl` and any
  validation schema. This package only runs the mechanics.
- **No secrets, ever.** Tokens are read from the Keychain and passed only into the op
  child process env — never printed, never written to disk. Nothing project- or
  account-specific is hardcoded (all via config), so this repo is safe to publish.
- **Adopt, don't build:** `chalk` (colour), `@t3-oss/env` (validation, in the project),
  `execa` (no-shell subprocess), `yaml` + `zod` (config).

## Develop

```
npm install
npm run typecheck
npm test
```
