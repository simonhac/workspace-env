/**
 * @simon/workspace-env — config-driven Conductor workspace setup/run.
 *
 * A repo's env/setup.ts and env/run.ts are byte-identical two-line wrappers:
 *
 *   import { runSetupFromConfig } from "@simon/workspace-env";
 *   process.exit(await runSetupFromConfig(import.meta.url));
 *
 * The per-project surface is env/workspace.config.yaml (see README).
 */

export { runSetupFromConfig, runDevFromConfig, runUseFromConfig } from "./runner";
export { registry as phases, resolvePhase, resolvePhases } from "./phases/index";
export { output, colourRole } from "./lib/output";
export { findFreePort } from "./lib/ports";
export { parseEnvFile, readEnvFile, loadEnvChain } from "./lib/env-file";
export { loadConfig, normalizeEntry, CONFIG_FILENAME } from "./config";
export type { WorkspaceConfig, PhaseEntry } from "./config";
export type {
  Phase,
  PhaseContext,
  PhaseFactory,
  CheckResult,
  CheckStatus,
  Output,
  EnvRole,
  RunFn,
  RunResult,
  RunOptions,
} from "./types";
