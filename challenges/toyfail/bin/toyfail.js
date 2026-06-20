#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
process.env.BENCHFORGE_CHALLENGE_ROOT = resolve(here, "..");
await import("../../../packages/core/src/cli.js");
