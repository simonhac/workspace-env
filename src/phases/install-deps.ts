/**
 * Install dependencies for one or more apps in the repo. Multi-app + per-dir
 * package manager (npm/pnpm/bun) so a monorepo (clara: web=pnpm, bot=bun) or a
 * dual app (ootnaboot: root + mobile) is a data declaration, not a fork.
 */

import fs from "node:fs";
import path from "node:path";
import type { Phase, PhaseContext } from "../types";

type Manager = "npm" | "pnpm" | "bun";
interface App {
  dir: string;
  manager: Manager;
  args?: string[];
}

function appsFromOpts(opts: Record<string, unknown>): App[] {
  if (Array.isArray(opts.apps)) return opts.apps as App[];
  return [
    {
      dir: (opts.dir as string) ?? ".",
      manager: (opts.manager as Manager) ?? "npm",
      args: (opts.args as string[]) ?? [],
    },
  ];
}

export function installDeps(opts: Record<string, unknown>): Phase {
  return {
    title: "Dependencies",
    async setup(ctx: PhaseContext) {
      for (const app of appsFromOpts(opts)) {
        const cwd = path.resolve(ctx.root, app.dir);
        const label = app.dir === "." ? app.manager : `${app.manager} (${app.dir})`;
        if (fs.existsSync(path.join(cwd, "node_modules")) && !ctx.force) {
          ctx.out.info(`${label}: node_modules present — skipping (use --force to reinstall)`);
          continue;
        }
        if (app.manager === "pnpm") await ctx.run(["corepack", "enable", "pnpm"]);
        const { code, stderr } = await ctx.run([app.manager, "install", ...(app.args ?? [])], { cwd });
        if (code === 0) ctx.out.success(`${label} install`);
        else {
          ctx.out.error(`${label} install failed: ${stderr}`);
          ctx.fail(`${label} install failed`);
        }
      }
    },
  };
}
