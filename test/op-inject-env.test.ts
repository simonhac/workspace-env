import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { opInjectEnv } from "../src/phases/op-inject-env";
import type { Output, PhaseContext, RunFn, RunResult } from "../src/types";

function makeOut() {
  const msgs: { level: string; msg: string }[] = [];
  const out: Output = {
    success: (m) => msgs.push({ level: "success", msg: m }),
    error: (m) => msgs.push({ level: "error", msg: m }),
    warn: (m) => msgs.push({ level: "warn", msg: m }),
    info: (m) => msgs.push({ level: "info", msg: m }),
    role: (n) => n,
  };
  return { out, msgs, text: () => msgs.map((m) => m.msg).join("\n") };
}

type Script = (cmd: string[]) => RunResult | undefined;
const makeRun =
  (script: Script): RunFn =>
  async (cmd) =>
    script(cmd) ?? { code: 0, stdout: "", stderr: "" };

function makeCtx(root: string, run: RunFn, out: Output, errors: string[]): PhaseContext {
  return {
    project: "demo",
    root,
    configDir: path.join(root, "env"),
    force: false,
    out,
    run,
    fail: (m) => errors.push(m),
  };
}

function tmpRoot(withTpl: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "we-op-"));
  if (withTpl) fs.writeFileSync(path.join(dir, ".env.tpl"), 'X="op://demo-dev/env/X"\n');
  return dir;
}

const SAVED = process.env.OP_SERVICE_ACCOUNT_TOKEN;
beforeEach(() => {
  delete process.env.OP_SERVICE_ACCOUNT_TOKEN;
});
afterEach(() => {
  if (SAVED === undefined) delete process.env.OP_SERVICE_ACCOUNT_TOKEN;
  else process.env.OP_SERVICE_ACCOUNT_TOKEN = SAVED;
});

describe("opInjectEnv", () => {
  it("skips when .env.tpl is absent", async () => {
    const root = tmpRoot(false);
    const { out, text } = makeOut();
    const errors: string[] = [];
    await opInjectEnv({}).setup!(makeCtx(root, makeRun(() => undefined), out, errors));
    expect(errors).toHaveLength(0);
    expect(text()).toMatch(/skipping env bootstrap/);
  });

  it("skips (warns) when the op CLI is missing", async () => {
    const root = tmpRoot(true);
    const { out, text } = makeOut();
    const errors: string[] = [];
    const run = makeRun((cmd) =>
      cmd[0] === "op" && cmd[1] === "--version" ? { code: 127, stdout: "", stderr: "" } : undefined,
    );
    await opInjectEnv({}).setup!(makeCtx(root, run, out, errors));
    expect(errors).toHaveLength(0);
    expect(text()).toMatch(/op\) not found/);
  });

  it("injects via the env token when OP_SERVICE_ACCOUNT_TOKEN is set", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "ops_test";
    const root = tmpRoot(true);
    const { out, text } = makeOut();
    const errors: string[] = [];
    const run = makeRun((cmd) =>
      cmd[0] === "op" && cmd[1] === "whoami" ? { code: 0, stdout: "", stderr: "" } : undefined,
    );
    await opInjectEnv({}).setup!(makeCtx(root, run, out, errors));
    expect(errors).toHaveLength(0);
    expect(text()).toMatch(/via service account \(env\)/);
  });

  it("diagnoses an AUTH failure when 1Password is reachable", async () => {
    const root = tmpRoot(true);
    const { out, text } = makeOut();
    const errors: string[] = [];
    const run = makeRun((cmd) => {
      if (cmd[0] === "security") return { code: 1, stdout: "", stderr: "" }; // no keychain token
      if (cmd[0] === "op" && cmd[1] === "whoami") return { code: 1, stdout: "", stderr: "" };
      if (cmd[0] === "curl") return { code: 0, stdout: "", stderr: "" }; // reachable
      return undefined;
    });
    await opInjectEnv({}).setup!(makeCtx(root, run, out, errors));
    expect(errors).toContain("op not authenticated");
    expect(text()).toMatch(/AUTH problem/);
  });

  it("diagnoses a NETWORK failure when 1Password is unreachable", async () => {
    const root = tmpRoot(true);
    const { out, text } = makeOut();
    const errors: string[] = [];
    const run = makeRun((cmd) => {
      if (cmd[0] === "security") return { code: 1, stdout: "", stderr: "" };
      if (cmd[0] === "op" && cmd[1] === "whoami") return { code: 1, stdout: "", stderr: "" };
      if (cmd[0] === "curl") return { code: 7, stdout: "", stderr: "" }; // unreachable
      return undefined;
    });
    await opInjectEnv({}).setup!(makeCtx(root, run, out, errors));
    expect(errors).toContain("1Password API unreachable (network)");
    expect(text()).toMatch(/NETWORK issue/);
  });

  it("unlinks a symlinked .env.local before writing (never clobbers the shared file)", async () => {
    process.env.OP_SERVICE_ACCOUNT_TOKEN = "ops_test";
    const root = tmpRoot(true);
    const shared = path.join(root, "shared.env");
    fs.writeFileSync(shared, "SHARED=1\n");
    const target = path.join(root, ".env.local");
    fs.symlinkSync(shared, target);
    const { out } = makeOut();
    const errors: string[] = [];
    const run = makeRun((cmd) =>
      cmd[0] === "op" && cmd[1] === "whoami" ? { code: 0, stdout: "", stderr: "" } : undefined,
    );
    await opInjectEnv({}).setup!(makeCtx(root, run, out, errors));
    expect(errors).toHaveLength(0);
    // fake `op inject` doesn't write, so after unlinking the symlink the target is gone…
    expect(fs.existsSync(target)).toBe(false);
    // …and the shared file it pointed at is untouched.
    expect(fs.readFileSync(shared, "utf8")).toBe("SHARED=1\n");
  });
});
