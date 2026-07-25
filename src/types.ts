/**
 * Shared contracts for the workspace-env runner and its phases.
 *
 * A phase is a small unit of setup/run work (install deps, inject env from
 * 1Password, validate, verify, …). Phases never own colour/subprocess/header
 * plumbing — they receive it via `PhaseContext`, so the runner stays the single
 * place that renders output and the phases stay trivially testable.
 */

export type CheckStatus = "ok" | "info" | "warn" | "fail";

export interface CheckResult {
  status: CheckStatus;
  message: string;
}

export interface RunResult {
  /** Process exit code; 0 on success, non-zero (or 1 on spawn error) otherwise. */
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  /** Extra env merged over `process.env` for this call only (e.g. an op token). */
  env?: Record<string, string>;
}

/** No-shell subprocess runner (execa under the hood). Injected so tests can fake it. */
export type RunFn = (cmd: string[], opts?: RunOptions) => Promise<RunResult>;

/** Env-role → colour, used to make "which backend am I pointed at" obvious. */
export type EnvRole = "production" | "development" | "migration-target";

export interface Output {
  success(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
  info(msg: string): void;
  /** Colour a name by its env role (prod=red safety signal, dev=green, migration=cyan). */
  role(name: string, role: EnvRole): string;
}

export interface PhaseContext {
  /** Project slug, e.g. "my-app" — drives keychain item, vault names, labels. */
  project: string;
  /** Repo/worktree root (the dir that contains `env/`). */
  root: string;
  /** Directory holding workspace.config.yaml + the wrappers (usually `<root>/env`). */
  configDir: string;
  /** `--force` was passed. */
  force: boolean;
  out: Output;
  run: RunFn;
  /** Record a fatal problem; the runner reports these and exits non-zero. */
  fail(message: string): void;
}

/**
 * A phase. `setup()` runs during `runSetupFromConfig`; `preflight()` runs before
 * the dev server in `runDevFromConfig` and returns lines to print + gate on.
 */
export interface Phase {
  title: string;
  setup?(ctx: PhaseContext): void | Promise<void>;
  preflight?(ctx: PhaseContext): CheckResult[] | Promise<CheckResult[]>;
}

/** A built-in phase is created from its config options. */
export type PhaseFactory = (opts: Record<string, unknown>) => Phase;
