/**
 * Validate the environment by running the PROJECT's own schema (adopt, don't
 * build). A project points `schema` at a module that calls `@t3-oss/env`'s
 * `createEnv(...)` at import time (throwing on invalid). We load the repo's
 * `.env` chain into process.env first (tsx doesn't, unlike Next.js), then
 * import the schema. Env vars stay the project's business; we just run its check.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvChain } from "../lib/env-file";
import type { CheckResult, Phase, PhaseContext } from "../types";

async function validate(ctx: PhaseContext, opts: Record<string, unknown>): Promise<CheckResult[]> {
  const root = path.resolve(ctx.root, (opts.cwd as string) ?? ".");
  loadEnvChain(root);

  const schema = opts.schema as string | undefined;
  if (!schema) {
    return [{ status: "info", message: "env validation: no schema configured — skipping" }];
  }
  const mod = path.isAbsolute(schema) ? schema : path.resolve(ctx.configDir, schema);
  try {
    await import(pathToFileURL(mod).href); // t3-env createEnv throws on invalid
    return [{ status: "ok", message: "env validation passed" }];
  } catch (e) {
    return [{ status: "fail", message: `env validation failed: ${(e as Error).message}` }];
  }
}

export function validateEnv(opts: Record<string, unknown>): Phase {
  return {
    title: "Environment validation",
    async setup(ctx: PhaseContext) {
      for (const r of await validate(ctx, opts)) {
        if (r.status === "ok") ctx.out.success(r.message);
        else if (r.status === "info") ctx.out.info(r.message);
        else if (r.status === "warn") ctx.out.warn(r.message);
        else {
          ctx.out.error(r.message);
          ctx.fail(r.message);
        }
      }
    },
    async preflight(ctx: PhaseContext) {
      return validate(ctx, opts);
    },
  };
}
