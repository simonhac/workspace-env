/**
 * Schema + loader for a project's `env/workspace.config.yaml` — the only
 * per-project artifact. Everything else (setup.ts/run.ts wrappers) is byte-
 * identical across repos and just calls the runner, which reads this file.
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const CONFIG_FILENAME = "workspace.config.yaml";

const PortSchema = z
  .object({
    from: z.number().int().positive(),
    span: z.number().int().positive().optional(),
    to: z.number().int().positive().optional(),
  })
  .strict();

const RunSchema = z
  .object({
    command: z.union([z.string(), z.array(z.string())]),
    cwd: z.string().optional(),
    port: PortSchema.optional(),
  })
  .strict();

/** A phase entry: bare id ("verify"), or an object { phase: id, ...opts }. */
const PhaseEntrySchema = z.union([
  z.string(),
  z.object({ phase: z.string() }).passthrough(),
]);

const BackendSchema = z
  .object({ role: z.enum(["production", "development", "migration-target"]) })
  .strict();

export const ConfigSchema = z
  .object({
    project: z.string().min(1),
    setup: z.array(PhaseEntrySchema).default([]),
    run: RunSchema.optional(),
    backends: z.record(BackendSchema).optional(),
  })
  .strict();

export type WorkspaceConfig = z.infer<typeof ConfigSchema>;
export type PhaseEntry = z.infer<typeof PhaseEntrySchema>;

export function loadConfig(configDir: string): WorkspaceConfig {
  const file = path.join(configDir, CONFIG_FILENAME);
  if (!fs.existsSync(file)) {
    throw new Error(`workspace-env: ${CONFIG_FILENAME} not found in ${configDir}`);
  }
  let raw: unknown;
  try {
    raw = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`workspace-env: failed to parse ${file}: ${(e as Error).message}`);
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`workspace-env: invalid ${CONFIG_FILENAME}:\n${issues}`);
  }
  return parsed.data;
}

export interface NormalizedEntry {
  id: string;
  opts: Record<string, unknown>;
}

export function normalizeEntry(entry: PhaseEntry): NormalizedEntry {
  if (typeof entry === "string") return { id: entry, opts: {} };
  const { phase, ...opts } = entry as { phase: string } & Record<string, unknown>;
  return { id: phase, opts };
}
