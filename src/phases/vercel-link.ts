/**
 * Ensure `<cwd>/.vercel/project.json` exists so `vercel` deploys/env-pull work.
 * Idempotent; skips when already linked (unless --force). Degrades to a warning
 * when the Vercel CLI isn't installed.
 */

import fs from "node:fs";
import path from "node:path";
import type { CheckResult, Phase, PhaseContext } from "../types";

function projectJson(ctx: PhaseContext, opts: Record<string, unknown>): string {
  const cwd = path.resolve(ctx.root, (opts.cwd as string) ?? ".");
  return path.join(cwd, ".vercel", "project.json");
}

export function vercelLink(opts: Record<string, unknown>): Phase {
  return {
    title: "Vercel project link",
    async setup(ctx: PhaseContext) {
      const cwd = path.resolve(ctx.root, (opts.cwd as string) ?? ".");
      const project = (opts.project as string) ?? ctx.project;
      const target = projectJson(ctx, opts);
      if (fs.existsSync(target) && !ctx.force) {
        ctx.out.success("Already linked to Vercel");
        return;
      }
      const { code: v } = await ctx.run(["vercel", "--version"]);
      if (v !== 0) {
        ctx.out.warn("vercel CLI not found — skipping link (install with `npm i -g vercel`)");
        return;
      }
      const { code, stdout, stderr } = await ctx.run([
        "vercel", "link", "--cwd", cwd, "--project", project, "--yes",
      ]);
      if (code === 0 && fs.existsSync(target)) {
        ctx.out.success(`Linked to Vercel project '${project}'`);
      } else {
        ctx.out.error(`vercel link failed: ${stderr || stdout}`);
        ctx.fail("vercel link failed");
      }
    },
    preflight(ctx: PhaseContext): CheckResult[] {
      return [
        fs.existsSync(projectJson(ctx, opts))
          ? { status: "ok", message: ".vercel/project.json exists" }
          : { status: "warn", message: ".vercel/project.json missing" },
      ];
    },
  };
}
