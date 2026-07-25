/**
 * Read a generic-password secret from the macOS login Keychain. Used to vend a
 * dev 1Password service-account token to non-interactive Conductor setup —
 * item name `op-sa-<project>-dev` (see the infra repo's onboard tooling).
 *
 * The token is returned to the caller and passed only into the op child
 * process's env; it is never printed or written to disk.
 */

import type { RunFn } from "../types";

export async function readKeychainToken(
  run: RunFn,
  service: string,
): Promise<string | undefined> {
  if (process.platform !== "darwin") return undefined;
  const { code, stdout } = await run([
    "security",
    "find-generic-password",
    "-s",
    service,
    "-w",
  ]);
  return code === 0 && stdout ? stdout.trim() : undefined;
}
