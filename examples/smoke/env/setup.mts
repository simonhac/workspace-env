#!/usr/bin/env -S npx --yes tsx
import { runSetupFromConfig } from "@simon/workspace-env";
process.exit(await runSetupFromConfig(import.meta.url));
