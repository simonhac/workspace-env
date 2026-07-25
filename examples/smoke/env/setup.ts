#!/usr/bin/env npx tsx
import { runSetupFromConfig } from "@simon/workspace-env";
process.exit(await runSetupFromConfig(import.meta.url));
