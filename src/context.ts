/**
 * Build the PhaseContext handed to every phase. `run` and `out` are injectable
 * so tests can supply fakes and capture output.
 */

import path from "node:path";
import { output as defaultOutput } from "./lib/output";
import { run as defaultRun } from "./lib/run";
import type { Output, PhaseContext, RunFn } from "./types";

export interface ContextInit {
  project: string;
  configDir: string;
  root?: string;
  force?: boolean;
  out?: Output;
  run?: RunFn;
  errors: string[];
}

export function buildContext(init: ContextInit): PhaseContext {
  return {
    project: init.project,
    root: init.root ?? path.resolve(init.configDir, ".."),
    configDir: init.configDir,
    force: init.force ?? false,
    out: init.out ?? defaultOutput,
    run: init.run ?? defaultRun,
    fail: (message: string) => {
      init.errors.push(message);
    },
  };
}
