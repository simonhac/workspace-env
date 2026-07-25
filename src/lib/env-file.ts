/**
 * Canonical dotenv parser — the single implementation for the ecosystem
 * (matches the infra repo's `src/env.ts parseEnvFile`, replacing the per-repo
 * origin-tracer copies that had drifted, one of which was uppercase-key-only).
 *
 * Parses `KEY=VALUE` (optional `export ` prefix, optional surrounding single or
 * double quotes). Values are returned verbatim — treat them as secret. Blank
 * lines and `#` comments are ignored.
 */

import fs from "node:fs";

export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let key = trimmed.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice("export ".length).trim();
    if (!key) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Parse a dotenv file if it exists; `{}` when absent. */
export function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return parseEnvFile(fs.readFileSync(filePath, "utf8"));
}

/**
 * Load a repo's `.env` chain into `process.env` (without overriding values
 * already set), so a validator run under tsx sees what Next.js would load.
 */
export function loadEnvChain(root: string): void {
  const mode = process.env.NODE_ENV || "development";
  const files = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
  for (const name of files) {
    const entries = readEnvFile(`${root}/${name}`);
    for (const [k, v] of Object.entries(entries)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}
