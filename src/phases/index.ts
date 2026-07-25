/**
 * Built-in phase registry + resolution of a config entry to a Phase.
 * A `{ phase: local, module, export }` entry dynamic-imports project-local code
 * (clara's venv/data-bundle, ootnaboot's Expo) — so bespoke logic stays in the
 * one or two repos that need it while the wrappers remain byte-identical.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeEntry, type PhaseEntry } from "../config";
import type { Phase, PhaseFactory } from "../types";
import { installDeps } from "./install-deps";
import { opInjectEnv } from "./op-inject-env";
import { validateEnv } from "./validate-env";
import { vercelLink } from "./vercel-link";
import { verify } from "./verify";

export const registry: Record<string, PhaseFactory> = {
  installDeps,
  opInjectEnv,
  validateEnv,
  vercelLink,
  verify,
};

function isPhase(x: unknown): x is Phase {
  return !!x && typeof x === "object" && typeof (x as Phase).title === "string";
}

export async function resolvePhase(entry: PhaseEntry, configDir: string): Promise<Phase> {
  const { id, opts } = normalizeEntry(entry);

  if (id === "local") {
    const modPath = opts.module as string | undefined;
    const exportName = (opts.export as string) ?? "default";
    if (!modPath) throw new Error("workspace-env: a 'local' phase needs a 'module' path");
    const abs = path.isAbsolute(modPath) ? modPath : path.resolve(configDir, modPath);
    const mod = (await import(pathToFileURL(abs).href)) as Record<string, unknown>;
    const exp = mod[exportName];
    if (typeof exp === "function") return (exp as PhaseFactory)(opts);
    if (isPhase(exp)) return exp;
    throw new Error(
      `workspace-env: local phase ${modPath}#${exportName} is neither a Phase nor a PhaseFactory`,
    );
  }

  const factory = registry[id];
  if (!factory) {
    throw new Error(
      `workspace-env: unknown phase '${id}' — known: ${Object.keys(registry).join(", ")} ` +
        `(or use { phase: local, module: ./phases.local.ts, export: ... }).`,
    );
  }
  return factory(opts);
}

export async function resolvePhases(entries: PhaseEntry[], configDir: string): Promise<Phase[]> {
  return Promise.all(entries.map((e) => resolvePhase(e, configDir)));
}
