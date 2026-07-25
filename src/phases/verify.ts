/**
 * Final sanity checks: node_modules present (and, when relevant, the Vercel
 * link). Runs as a setup step and as a run-button preflight.
 */

import fs from "node:fs";
import path from "node:path";
import type { CheckResult, Phase, PhaseContext } from "../types";

function checks(ctx: PhaseContext, opts: Record<string, unknown>): CheckResult[] {
  const cwd = path.resolve(ctx.root, (opts.cwd as string) ?? ".");
  const results: CheckResult[] = [];
  results.push(
    fs.existsSync(path.join(cwd, "node_modules"))
      ? { status: "ok", message: "node_modules exists" }
      : { status: "fail", message: "node_modules missing — run setup" },
  );
  return results;
}

export function verify(opts: Record<string, unknown>): Phase {
  return {
    title: "Verification",
    setup(ctx: PhaseContext) {
      for (const r of checks(ctx, opts)) {
        if (r.status === "ok") ctx.out.success(r.message);
        else {
          ctx.out.error(r.message);
          ctx.fail(r.message);
        }
      }
    },
    preflight(ctx: PhaseContext) {
      return checks(ctx, opts);
    },
  };
}
