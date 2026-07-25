/**
 * No-shell subprocess runner. Uses execa so arguments are passed as an argv
 * array (never through a shell) — safe to hand secret tokens via `env`.
 */

import { execa } from "execa";
import type { RunFn, RunResult, RunOptions } from "../types";

export const run: RunFn = async (
  cmd: string[],
  opts: RunOptions = {},
): Promise<RunResult> => {
  const [file, ...args] = cmd;
  try {
    const res = await execa(file, args, {
      cwd: opts.cwd,
      env: opts.env ? { ...process.env, ...opts.env } : undefined,
      reject: false,
      all: false,
    });
    return {
      code: res.exitCode ?? (res.failed ? 1 : 0),
      stdout: (res.stdout ?? "").toString().trim(),
      stderr: (res.stderr ?? "").toString().trim(),
    };
  } catch (err) {
    // Spawn failure (e.g. binary not found): surface as a non-zero result
    // rather than throwing, so phases branch on `code` uniformly.
    const e = err as { shortMessage?: string; message?: string };
    return { code: 127, stdout: "", stderr: e.shortMessage ?? e.message ?? String(err) };
  }
};
