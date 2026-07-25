/**
 * Terminal output for the runner. Colour comes from `chalk`; the only bespoke
 * bit is the semantic `role()` mapping (prod=red safety signal, dev=green,
 * migration-target=cyan), lifted from boost's tested `_colours.ts`.
 */

import chalk from "chalk";
import type { CheckResult, EnvRole, Output } from "../types";

const ROLE_COLOUR: Record<EnvRole, (s: string) => string> = {
  production: chalk.red,
  development: chalk.green,
  "migration-target": chalk.cyan,
};

/** Colour a name by env role; an unknown role returns the name plain. */
export function colourRole(name: string, role: EnvRole): string {
  const paint = ROLE_COLOUR[role];
  return paint ? paint(name) : name;
}

/** The `Output` handed to every phase. */
export const output: Output = {
  success: (m) => console.log(`      ${chalk.green("✓")} ${m}`),
  error: (m) => console.log(`      ${chalk.red("✗")} ${m}`),
  warn: (m) => console.log(`      ${chalk.yellow("!")} ${m}`),
  info: (m) => console.log(`      ${chalk.blue("ℹ")} ${m}`),
  role: colourRole,
};

/** Render one CheckResult through the Output (used by preflight printing). */
export function printCheck(out: Output, r: CheckResult): void {
  if (r.status === "ok") out.success(r.message);
  else if (r.status === "info") out.info(r.message);
  else if (r.status === "warn") out.warn(r.message);
  else out.error(r.message);
}

export function phaseHeader(n: number, total: number, title: string): void {
  console.log(`${chalk.cyan(`[${n}/${total}]`)} ${title}`);
}

export function setupHeader(project: string): void {
  const bar = chalk.cyan("=".repeat(48));
  console.log(bar);
  console.log(chalk.cyan(`  WORKSPACE SETUP — ${project}`));
  console.log(bar);
  console.log();
}

export function setupFooter(errors: string[], seconds: number): void {
  console.log();
  const bar = "=".repeat(48);
  console.log(bar);
  if (errors.length > 0) {
    const s = errors.length === 1 ? "" : "s";
    console.log(chalk.red(`✗ Setup failed (${errors.length} error${s}) in ${seconds.toFixed(1)}s`));
  } else {
    console.log(chalk.green(`✓ Setup complete (${seconds.toFixed(1)}s)`));
  }
  console.log(bar);
}

export function preflightHeader(): void {
  console.log(chalk.cyan("Pre-flight checks"));
}

export function preflightFailed(): void {
  console.log(`\n${chalk.red("Pre-flight failed.")} Run: ./env/setup.ts`);
}
