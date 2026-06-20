import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const identifierPattern = /^[a-z][a-z0-9-]*$/;
const coreCliPath = resolve(dirname(fileURLToPath(import.meta.url)), "cli.js");

function titleFromId(id) {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function assertIdentifier(value, field) {
  if (!identifierPattern.test(value)) {
    throw new Error(`${field} must match ${identifierPattern}`);
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function writeText(path, content) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
}

export async function createChallenge(options) {
  const id = options.id;
  const cli = options.cli ?? id;
  const name = options.name ?? titleFromId(id);
  const root = options.root ?? process.cwd();
  const force = options.force ?? false;

  assertIdentifier(id, "id");
  assertIdentifier(cli, "cli");

  const challengeRoot = join(root, "challenges", id);
  if (!force && await exists(challengeRoot)) {
    throw new Error(`challenge already exists: ${challengeRoot}`);
  }

  await mkdir(join(challengeRoot, "bin"), { recursive: true });
  await mkdir(join(challengeRoot, "starter"), { recursive: true });
  await mkdir(join(challengeRoot, "harness"), { recursive: true });

  const rootHasBenchforgeCore = await exists(join(root, "packages", "core", "src", "cli.js"));
  const localCoreFallback = rootHasBenchforgeCore ? "" : `,\n  ${JSON.stringify(coreCliPath)}`;

  await writeText(join(challengeRoot, "bin", `${cli}.js`), `#!/usr/bin/env node
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
process.env.BENCHFORGE_CHALLENGE_ROOT = resolve(here, "..");

const coreCandidates = [
  resolve(here, "../../../packages/core/src/cli.js"),
  process.env.BENCHFORGE_CORE_CLI${localCoreFallback}
].filter(Boolean);

let lastError = null;
for (const candidate of coreCandidates) {
  try {
    await access(candidate);
  } catch (error) {
    lastError = error;
    continue;
  }
  await import(pathToFileURL(candidate).href);
  lastError = null;
  break;
}

if (lastError) {
  throw new Error("Could not find Benchforge core CLI. Set BENCHFORGE_CORE_CLI or create challenges inside a Benchforge repo.");
}
`);

  await writeText(join(challengeRoot, "challenge.json"), `${JSON.stringify({
    id,
    name,
    cli,
    version: "0.1.0",
    score: {
      direction: "minimize",
      primaryMetric: "time_ms",
      secondaryMetrics: ["correctness_cases", "checksum"]
    },
    scorePath: "score.json",
    editablePaths: ["starter/solution.js"],
    forbiddenPaths: ["harness/**", "challenge.json"],
    commands: {
      test: "node harness/test.js",
      score: "node harness/score.js"
    }
  }, null, 2)}\n`);

  await writeText(join(challengeRoot, "starter", "solution.js"), `export function solve(input) {
  const output = [];
  for (const value of input) {
    if ((value & 1) === 0) {
      output.push(value * 3 + 7);
    } else {
      output.push(value + 13);
    }
  }
  return output;
}
`);

  await writeText(join(challengeRoot, "harness", "test.js"), `import assert from "node:assert/strict";
import { solve } from "../starter/solution.js";

function reference(input) {
  return input.map((value) => {
    if ((value & 1) === 0) {
      return value * 3 + 7;
    }
    return value + 13;
  });
}

function makeCase(seed, size) {
  let state = seed >>> 0;
  const values = [];
  for (let index = 0; index < size; index += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    values.push(state % 1000003);
  }
  return values;
}

let cases = 0;
for (let seed = 1; seed <= 32; seed += 1) {
  const input = makeCase(seed, 128);
  assert.deepEqual(solve(input), reference(input));
  cases += 1;
}

console.log("${cli}: " + cases + " public correctness cases passed");
`);

  await writeText(join(challengeRoot, "harness", "score.js"), `import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { solve } from "../starter/solution.js";

function makeInput(size) {
  let state = 123456789;
  const values = [];
  for (let index = 0; index < size; index += 1) {
    state = (1103515245 * state + 12345) >>> 0;
    values.push(state % 1000003);
  }
  return values;
}

const input = makeInput(100000);
let checksum = 0;
const samples = [];

for (let run = 0; run < 5; run += 1) {
  const started = performance.now();
  const output = solve(input);
  const elapsed = performance.now() - started;
  samples.push(elapsed);
  checksum ^= output[(run * 7919) % output.length] >>> 0;
}

samples.sort((a, b) => a - b);
const median = samples[Math.floor(samples.length / 2)];

writeFileSync("score.json", JSON.stringify({
  score: median,
  metrics: {
    time_ms: median,
    correctness_cases: 32,
    checksum
  }
}, null, 2));
`);

  await writeText(join(challengeRoot, "README.md"), `# ${name}

${name} is a Benchforge challenge.

Goal: make \`starter/solution.js\` faster without changing behavior.

Allowed edits:

- \`starter/solution.js\`

Run:

\`\`\`bash
node ./challenges/${id}/bin/${cli}.js doctor --run
node ./challenges/${id}/bin/${cli}.js run
node ./challenges/${id}/bin/${cli}.js submit --verify --bundle-output .benchforge/latest.bundle.json --output .benchforge/verifier-result.json
node ./challenges/${id}/bin/${cli}.js verify --bundle .benchforge/latest.bundle.json --json --output .benchforge/verifier-result.json
node ./challenges/${id}/bin/${cli}.js leaderboard
node ./challenges/${id}/bin/${cli}.js publish-verification --api "$BENCHFORGE_API_URL" --token "$BENCHFORGE_API_TOKEN"
node ./challenges/${id}/bin/${cli}.js hosted leaderboard --api "$BENCHFORGE_API_URL"
\`\`\`

Local scores are useful for iteration. Public trust requires an independent verifier.
`);

  await writeText(join(challengeRoot, "SKILL.md"), `---
name: ${id}
description: Work on the ${name} Benchforge challenge. Use when optimizing ${name}, running the ${cli} CLI, submitting candidate packages, verifying verifier-result JSON, reading notes, or respecting this challenge's editable and forbidden paths.
---

# ${name} Agent Skill

You are working on ${name}, a local-first Benchforge challenge.

Objective: minimize \`time_ms\` while preserving the behavior of \`starter/solution.js\`.

Editable files:

- \`starter/solution.js\`

Do not edit:

- \`harness/\`
- \`challenge.json\`
- \`.benchforge/\` except through the CLI

Commands:

\`\`\`bash
node ./challenges/${id}/bin/${cli}.js doctor --run
node ./challenges/${id}/bin/${cli}.js run
node ./challenges/${id}/bin/${cli}.js submit --verify --bundle-output .benchforge/latest.bundle.json --output .benchforge/verifier-result.json
node ./challenges/${id}/bin/${cli}.js verify --bundle .benchforge/latest.bundle.json --json --output .benchforge/verifier-result.json
node ./challenges/${id}/bin/${cli}.js leaderboard
node ./challenges/${id}/bin/${cli}.js publish-verification --api "$BENCHFORGE_API_URL" --token "$BENCHFORGE_API_TOKEN"
\`\`\`

Only trust a score after tests pass and the CLI records a run.

Before any forceful update or sync workflow, confirm \`doctor\` reports the expected challenge root and git context.
`);

  return {
    id,
    cli,
    name,
    root: challengeRoot,
    command: `node ./challenges/${id}/bin/${cli}.js run`
  };
}
