/**
 * The three entry points the identical wrappers call. Each locates
 * `env/workspace.config.yaml` next to the caller, resolves phases, and drives
 * them. `callerUrl` is the wrapper's `import.meta.url`.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config";
import { buildContext } from "./context";
import { resolvePhases } from "./phases/index";
import { findFreePort } from "./lib/ports";
import {
  output,
  phaseHeader,
  preflightFailed,
  preflightHeader,
  printCheck,
  setupFooter,
  setupHeader,
} from "./lib/output";
import type { CheckResult } from "./types";

function configDirFrom(callerUrl: string): string {
  return path.dirname(fileURLToPath(callerUrl));
}

/** Conductor "Setup" — run each declared phase's setup() in order. */
export async function runSetupFromConfig(callerUrl: string): Promise<number> {
  const start = Date.now();
  const configDir = configDirFrom(callerUrl);
  const cfg = loadConfig(configDir);
  const errors: string[] = [];
  const ctx = buildContext({
    project: cfg.project,
    configDir,
    force: process.argv.includes("--force"),
    errors,
  });

  setupHeader(cfg.project);
  const phases = (await resolvePhases(cfg.setup, configDir)).filter((p) => p.setup);
  for (let i = 0; i < phases.length; i++) {
    phaseHeader(i + 1, phases.length, phases[i].title);
    await phases[i].setup!(ctx);
    console.log();
  }
  setupFooter(errors, (Date.now() - start) / 1000);
  console.log();
  return errors.length ? 1 : 0;
}

/** Conductor "Run" — preflight checks, pick a free port, launch the dev command. */
export async function runDevFromConfig(callerUrl: string): Promise<void> {
  const configDir = configDirFrom(callerUrl);
  const cfg = loadConfig(configDir);
  const errors: string[] = [];
  const ctx = buildContext({ project: cfg.project, configDir, errors });

  preflightHeader();
  const phases = await resolvePhases(cfg.setup, configDir);
  const results: CheckResult[] = [];
  for (const p of phases) if (p.preflight) results.push(...(await p.preflight(ctx)));
  for (const r of results) printCheck(output, r);
  console.log();
  if (results.some((r) => r.status === "fail")) {
    preflightFailed();
    process.exit(1);
  }

  const runCfg = cfg.run;
  if (!runCfg) {
    output.warn("no `run` command configured in workspace.config.yaml");
    process.exit(0);
  }

  let port: number | undefined;
  if (runCfg.port) {
    const { from } = runCfg.port;
    const span = runCfg.port.span ?? (runCfg.port.to ? runCfg.port.to - from + 1 : 20);
    const free = await findFreePort(from, span);
    if (free === null) {
      output.error(`No free port in ${from}-${from + span - 1}`);
      process.exit(1);
    }
    port = free;
    if (port !== from) output.info(`Using port ${port} (${from} busy)`);
  }

  const cmd = Array.isArray(runCfg.command) ? runCfg.command : runCfg.command.split(/\s+/);
  const cwd = runCfg.cwd ? path.resolve(ctx.root, runCfg.cwd) : ctx.root;
  console.log("Starting dev server...\n");

  const { execa } = await import("execa");
  const env = { ...process.env, ...(port ? { PORT: String(port) } : {}) };
  const [file, ...args] = cmd;
  try {
    await execa(file, args, { cwd, stdio: "inherit", env });
  } catch {
    // Ctrl-C / non-zero exit — exit quietly.
  }
}

/** Conductor "Use" — switch backends (multi-backend repos). Not in this build. */
export async function runUseFromConfig(_callerUrl: string): Promise<number> {
  output.warn("`use` (backend switcher) is not implemented in this build yet.");
  return 1;
}
