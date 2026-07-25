/**
 * Resolve the main checkout for this worktree — the source Conductor copies
 * gitignored `.env.*.local` files from. Prefers Conductor's `CONDUCTOR_ROOT_PATH`,
 * else the shared git common-dir's parent. (Lifted from boost's setup.ts.)
 */

import path from "node:path";
import type { RunFn } from "../types";

export async function mainCheckout(run: RunFn, root: string): Promise<string | null> {
  if (process.env.CONDUCTOR_ROOT_PATH) return process.env.CONDUCTOR_ROOT_PATH;
  const { code, stdout } = await run(
    ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: root },
  );
  if (code !== 0 || !stdout) return null;
  // <main-checkout>/.git -> <main-checkout>
  return path.dirname(stdout.trim());
}
