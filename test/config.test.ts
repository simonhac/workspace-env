import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, normalizeEntry } from "../src/config";

function tmpConfig(yaml: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "we-cfg-"));
  fs.writeFileSync(path.join(dir, "workspace.config.yaml"), yaml);
  return dir;
}

describe("loadConfig", () => {
  it("parses a valid config", () => {
    const dir = tmpConfig(
      [
        "project: demo",
        "setup: [vercelLink, opInjectEnv, verify]",
        "run:",
        "  command: npm run dev",
        "  port: { from: 3000, span: 5 }",
      ].join("\n"),
    );
    const cfg = loadConfig(dir);
    expect(cfg.project).toBe("demo");
    expect(cfg.setup).toHaveLength(3);
    expect(cfg.run?.port?.from).toBe(3000);
    expect(cfg.run?.port?.span).toBe(5);
  });

  it("rejects a config missing `project`", () => {
    const dir = tmpConfig("setup: [verify]\n");
    expect(() => loadConfig(dir)).toThrow(/invalid/);
  });

  it("throws when the file is missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "we-cfg-"));
    expect(() => loadConfig(dir)).toThrow(/not found/);
  });
});

describe("normalizeEntry", () => {
  it("handles a bare string and an object entry", () => {
    expect(normalizeEntry("verify")).toEqual({ id: "verify", opts: {} });
    expect(
      normalizeEntry({ phase: "installDeps", args: ["--legacy-peer-deps"] } as never),
    ).toEqual({ id: "installDeps", opts: { args: ["--legacy-peer-deps"] } });
  });
});
