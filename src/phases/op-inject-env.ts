/**
 * Bootstrap `.env.local` from 1Password by `op inject`-ing the committed
 * `.env.tpl` (a file of `op://` references). The reference implementation,
 * lifted from the reference project's setup.ts phase 3 and parameterised so nothing project-
 * or account-specific is baked in.
 *
 * Auth order (so non-interactive Conductor setup self-bootstraps):
 *   1. OP_SERVICE_ACCOUNT_TOKEN already in the environment
 *   2. the dev service-account token from the macOS Keychain (op-sa-<project>-dev)
 *   3. an ambient personal `op` session (OP_ACCOUNT pinned)
 * On an auth failure we probe reachability to distinguish a NETWORK problem
 * (VPN/firewall) from a genuine AUTH problem, and never silently pass.
 * The token is passed only into op's child env — never printed, never on disk.
 */

import fs from "node:fs";
import path from "node:path";
import { readKeychainToken } from "../lib/keychain";
import type { Phase, PhaseContext, RunFn } from "../types";

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

async function onePasswordApiReachable(run: RunFn, account: string): Promise<boolean> {
  // curl exits 0 on ANY HTTP response, non-zero on a connection failure.
  const { code } = await run(["curl", "-sS", "-m", "8", "-o", "/dev/null", `https://${account}/`]);
  return code === 0;
}

export function opInjectEnv(opts: Record<string, unknown>): Phase {
  return {
    title: "1Password environment",
    async setup(ctx: PhaseContext) {
      const account = (opts.account as string) ?? "my.1password.com";
      const keychainItem = (opts.keychainItem as string) ?? `op-sa-${ctx.project}-dev`;
      const tpl = opts.tpl
        ? path.resolve(ctx.root, opts.tpl as string)
        : path.join(ctx.root, ".env.tpl");
      const target = opts.target
        ? path.resolve(ctx.root, opts.target as string)
        : path.join(ctx.root, ".env.local");

      if (!fs.existsSync(tpl)) {
        ctx.out.warn(`${path.basename(tpl)} not found — skipping env bootstrap`);
        return;
      }

      const { code: opCode } = await ctx.run(["op", "--version"]);
      if (opCode !== 0) {
        ctx.out.warn(
          "1Password CLI (op) not found — skipping env bootstrap. Install it " +
            "(https://developer.1password.com/docs/cli), then re-run, or create .env.local by hand.",
        );
        return;
      }

      let opEnv: Record<string, string> | undefined = { OP_ACCOUNT: account };
      let authSource = "personal op session";
      if (process.env.OP_SERVICE_ACCOUNT_TOKEN) {
        opEnv = undefined;
        authSource = "service account (env)";
      } else {
        const token = await readKeychainToken(ctx.run, keychainItem);
        if (token) {
          opEnv = { OP_SERVICE_ACCOUNT_TOKEN: token };
          authSource = "service account (Keychain)";
        }
      }

      const { code: authCode } = await ctx.run(["op", "whoami"], opEnv ? { env: opEnv } : {});
      if (authCode !== 0) {
        const reachable = await onePasswordApiReachable(ctx.run, account);
        const kept =
          fs.existsSync(target) && !isSymlink(target)
            ? " (An existing .env.local is left in place, so you can keep working, but this step FAILED — fix the above and re-run.)"
            : "";
        const diagnosis = reachable
          ? `1Password auth unavailable (op reached ${account}, so this is an AUTH problem, not the ` +
            `network). Setup is non-interactive, so it needs the headless service-account token. Store ` +
            `the ${ctx.project}-dev token in the Keychain, then re-run —\n` +
            `        security add-generic-password -U -a "$USER" -s ${keychainItem} -w\n` +
            `      (paste the token, then Ctrl-D). Interactive alternative: unlock the 1Password app ` +
            `(Settings → Developer → 'Integrate with 1Password CLI') and run \`op signin\`, then re-run.`
          : `1Password's API (${account}) is unreachable — the connection is being reset/refused. This ` +
            `is a NETWORK issue (VPN, firewall, or proxy), NOT missing auth: op can't reach 1Password to ` +
            `sign in. Allow \`*.1password.com\` (and \`*.b5local.com\`) through your VPN/firewall, or ` +
            `toggle the VPN, then re-run setup.`;
        ctx.out.error(diagnosis + kept);
        ctx.fail(reachable ? "op not authenticated" : "1Password API unreachable (network)");
        return;
      }

      // Legacy worktrees symlink .env.local to a shared home; `op inject -o` would
      // write THROUGH the symlink and clobber the shared file. Drop the symlink first.
      if (isSymlink(target)) {
        fs.unlinkSync(target);
        ctx.out.info("Removed legacy .env.local symlink (writing a real file instead)");
      }

      const { code, stdout, stderr } = await ctx.run(
        ["op", "inject", "-i", tpl, "-o", target, "--force"],
        opEnv ? { env: opEnv } : {},
      );
      if (code !== 0) {
        ctx.out.error(`op inject failed: ${stderr || stdout}`);
        ctx.fail("op inject failed");
        return;
      }
      ctx.out.success(
        `Wrote ${path.basename(target)} from ${path.basename(tpl)} (1Password, via ${authSource})`,
      );
    },
  };
}
