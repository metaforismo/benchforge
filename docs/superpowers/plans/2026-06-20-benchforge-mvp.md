# Benchforge MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first benchmark challenge factory that generates real branded CLIs, starting with a working `toyfail` challenge.

**Architecture:** `benchforge` is the reusable engine. Branded CLIs such as `toyfail` are thin executable wrappers that point the engine at a specific challenge pack and optional hosted API. The MVP stores runs, notes, artifacts, and local reports in `.benchforge/`, then later can submit to GitHub Actions or Cloudflare without changing the challenge interface.

**Tech Stack:** Node.js ESM, built-in `node:test`, no runtime dependencies for MVP, JSON challenge specs, shell harness commands, static HTML export.

---

## File Structure

Create this repository layout:

```text
package.json
README.md
docs/architecture.md
packages/core/src/cli.js
packages/core/src/spec.js
packages/core/src/store.js
packages/core/src/runner.js
packages/core/src/leaderboard.js
packages/core/src/receipts.js
packages/core/src/report.js
packages/core/test/spec.test.js
packages/core/test/store.test.js
packages/core/test/runner.test.js
packages/core/test/leaderboard.test.js
packages/core/test/receipts.test.js
challenges/toyfail/bin/toyfail.js
challenges/toyfail/challenge.json
challenges/toyfail/README.md
challenges/toyfail/SKILL.md
challenges/toyfail/starter/solution.js
challenges/toyfail/harness/test.js
challenges/toyfail/harness/score.js
skills/benchforge/SKILL.md
.github/workflows/test.yml
```

Responsibilities:

- `packages/core/src/spec.js`: load and validate challenge specs.
- `packages/core/src/store.js`: append/read local runs and notes under `.benchforge/`.
- `packages/core/src/runner.js`: execute harness commands and parse `score.json`.
- `packages/core/src/leaderboard.js`: rank local runs according to score direction.
- `packages/core/src/receipts.js`: produce tamper-evident local verification receipts.
- `packages/core/src/report.js`: export a static local leaderboard HTML file.
- `packages/core/src/cli.js`: command router used by all branded CLIs.
- `challenges/toyfail/bin/toyfail.js`: real branded CLI wrapper for the toy challenge.
- `challenges/toyfail/*`: first working challenge pack.
- `skills/benchforge/SKILL.md`: generic skill explaining how agents use the factory.

---

### Task 1: Repository Scaffold

**Files:**
- Create: `package.json`
- Create: `README.md`
- Create: `docs/architecture.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "benchforge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Local-first benchmark challenge factory with branded CLIs, notes, verifier receipts, and leaderboard exports.",
  "bin": {
    "benchforge": "./packages/core/src/cli.js",
    "toyfail": "./challenges/toyfail/bin/toyfail.js"
  },
  "scripts": {
    "test": "node --test",
    "toyfail": "node ./challenges/toyfail/bin/toyfail.js",
    "toyfail:run": "node ./challenges/toyfail/bin/toyfail.js run",
    "toyfail:score": "node ./challenges/toyfail/bin/toyfail.js score",
    "toyfail:leaderboard": "node ./challenges/toyfail/bin/toyfail.js leaderboard",
    "toyfail:report": "node ./challenges/toyfail/bin/toyfail.js export-site"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Benchforge

Benchforge is a local-first factory for benchmark arenas.

It lets you create challenge-specific CLIs such as `toyfail`, `rckfail`, or `grpoarena` while sharing one reusable engine for:

- local benchmark runs
- local notes
- submission artifacts
- verifier receipts
- leaderboard exports
- future hosted leaderboards

Local runs are useful for iteration, but public leaderboards should only trust independently verified submissions.

## Quick Start

```bash
npm test
npm run toyfail:run
npm run toyfail:leaderboard
npm run toyfail:report
```

## Why Branded CLIs Are Real

Each branded CLI is an executable wrapper that loads the shared Benchforge engine with a specific challenge pack.

For example, `toyfail` points to `challenges/toyfail/challenge.json`, then the core engine runs that pack's test, score, notes, and report commands.

The branding changes the user-facing command. The challenge spec changes the actual benchmark behavior.
```

- [ ] **Step 3: Create `docs/architecture.md`**

```markdown
# Architecture

Benchforge separates the reusable benchmark engine from challenge-specific packs.

```text
Branded CLI
  toyfail
  rckfail
  grpoarena

Benchforge Core
  spec loading
  command execution
  local store
  notes
  receipts
  leaderboard
  report export

Challenge Pack
  challenge.json
  harness/
  starter/
  SKILL.md
```

Local results are not public proof. A hosted/community deployment should promote only results reproduced by a trusted verifier.
```

- [ ] **Step 4: Run scaffold check**

Run:

```bash
npm test
```

Expected:

```text
0 tests
```

Node may print no tests found. That is acceptable before test files exist.

---

### Task 2: Challenge Spec Loader

**Files:**
- Create: `packages/core/src/spec.js`
- Create: `packages/core/test/spec.test.js`

- [ ] **Step 1: Write failing tests in `packages/core/test/spec.test.js`**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadChallengeSpec, validateChallengeSpec } from "../src/spec.js";

test("validateChallengeSpec accepts a complete spec", () => {
  const spec = {
    id: "toyfail",
    name: "Toyfail",
    cli: "toyfail",
    version: "0.1.0",
    score: { direction: "minimize", primaryMetric: "time_ms" },
    editablePaths: ["starter/solution.js"],
    commands: { test: "node harness/test.js", score: "node harness/score.js" }
  };

  assert.equal(validateChallengeSpec(spec).id, "toyfail");
});

test("validateChallengeSpec rejects missing command fields", () => {
  assert.throws(
    () => validateChallengeSpec({
      id: "bad",
      name: "Bad",
      cli: "bad",
      version: "0.1.0",
      score: { direction: "minimize", primaryMetric: "time_ms" },
      editablePaths: ["src/**"],
      commands: { test: "node test.js" }
    }),
    /commands.score is required/
  );
});

test("loadChallengeSpec reads challenge.json from disk", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-spec-"));
  await writeFile(join(root, "challenge.json"), JSON.stringify({
    id: "disk",
    name: "Disk Challenge",
    cli: "diskfail",
    version: "0.1.0",
    score: { direction: "maximize", primaryMetric: "ops_per_sec" },
    editablePaths: ["solution.js"],
    commands: { test: "node test.js", score: "node score.js" }
  }));

  const spec = await loadChallengeSpec(root);
  assert.equal(spec.id, "disk");
  assert.equal(spec.root, root);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test packages/core/test/spec.test.js
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Implement `packages/core/src/spec.js`**

```js
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array`);
  }
}

export function validateChallengeSpec(spec, root = process.cwd()) {
  if (!spec || typeof spec !== "object") {
    throw new Error("challenge spec must be an object");
  }

  requireString(spec.id, "id");
  requireString(spec.name, "name");
  requireString(spec.cli, "cli");
  requireString(spec.version, "version");

  if (!spec.score || typeof spec.score !== "object") {
    throw new Error("score is required");
  }
  if (!["minimize", "maximize"].includes(spec.score.direction)) {
    throw new Error("score.direction must be minimize or maximize");
  }
  requireString(spec.score.primaryMetric, "score.primaryMetric");
  requireArray(spec.editablePaths, "editablePaths");

  if (!spec.commands || typeof spec.commands !== "object") {
    throw new Error("commands is required");
  }
  requireString(spec.commands.test, "commands.test");
  requireString(spec.commands.score, "commands.score");

  return {
    ...spec,
    root: resolve(root),
    forbiddenPaths: spec.forbiddenPaths ?? [],
    hosted: spec.hosted ?? null
  };
}

export async function loadChallengeSpec(root = process.cwd()) {
  const specPath = join(root, "challenge.json");
  const raw = await readFile(specPath, "utf8");
  return validateChallengeSpec(JSON.parse(raw), root);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test packages/core/test/spec.test.js
```

Expected:

```text
pass
```

---

### Task 3: Local Store

**Files:**
- Create: `packages/core/src/store.js`
- Create: `packages/core/test/store.test.js`

- [ ] **Step 1: Write failing tests in `packages/core/test/store.test.js`**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendRun, listRuns, appendNote, listNotes } from "../src/store.js";

test("appendRun stores and listRuns reads JSONL runs", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-store-"));
  const run = await appendRun(root, {
    challengeId: "toyfail",
    status: "local",
    score: 12,
    metrics: { time_ms: 12 }
  });

  assert.ok(run.id.startsWith("run_"));
  const runs = await listRuns(root);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].score, 12);
});

test("appendNote stores searchable local notes", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-notes-"));
  await appendNote(root, {
    challengeId: "toyfail",
    tags: ["failure"],
    text: "branchless version failed hidden invariant"
  });

  const notes = await listNotes(root, "branchless");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].tags[0], "failure");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test packages/core/test/store.test.js
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Implement `packages/core/src/store.js`**

```js
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

function storeDir(root) {
  return join(root, ".benchforge");
}

async function ensureStore(root) {
  await mkdir(storeDir(root), { recursive: true });
}

async function appendJsonLine(path, value) {
  await appendFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

async function readJsonLines(path) {
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function appendRun(root, run) {
  await ensureStore(root);
  const record = {
    id: `run_${randomUUID()}`,
    createdAt: nowIso(),
    ...run
  };
  await appendJsonLine(join(storeDir(root), "runs.jsonl"), record);
  return record;
}

export async function listRuns(root) {
  return readJsonLines(join(storeDir(root), "runs.jsonl"));
}

export async function appendNote(root, note) {
  await ensureStore(root);
  const record = {
    id: `note_${randomUUID()}`,
    createdAt: nowIso(),
    tags: [],
    ...note
  };
  await appendJsonLine(join(storeDir(root), "notes.jsonl"), record);
  return record;
}

export async function listNotes(root, query = "") {
  const notes = await readJsonLines(join(storeDir(root), "notes.jsonl"));
  const needle = query.toLowerCase();
  if (!needle) return notes;
  return notes.filter((note) => {
    const text = `${note.text ?? ""} ${(note.tags ?? []).join(" ")}`.toLowerCase();
    return text.includes(needle);
  });
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test packages/core/test/store.test.js
```

Expected:

```text
pass
```

---

### Task 4: Runner and Score Parsing

**Files:**
- Create: `packages/core/src/runner.js`
- Create: `packages/core/test/runner.test.js`

- [ ] **Step 1: Write failing tests in `packages/core/test/runner.test.js`**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runChallengeCommand, runScore } from "../src/runner.js";

test("runChallengeCommand executes shell command in challenge root", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-runner-"));
  const result = await runChallengeCommand(root, "node -e \"console.log('ok')\"");
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /ok/);
});

test("runScore reads score.json produced by score command", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-score-"));
  await mkdir(join(root, "harness"));
  await writeFile(join(root, "harness", "score.js"), `
    import { writeFileSync } from "node:fs";
    writeFileSync("score.json", JSON.stringify({
      score: 42,
      metrics: { time_ms: 42, correctness_cases: 100 }
    }));
  `);

  const spec = {
    root,
    id: "toyfail",
    commands: { score: "node harness/score.js" }
  };

  const result = await runScore(spec);
  assert.equal(result.score, 42);
  assert.equal(result.metrics.correctness_cases, 100);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test packages/core/test/runner.test.js
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Implement `packages/core/src/runner.js`**

```js
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

export function runChallengeCommand(root, command) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      env: { ...process.env, BENCHFORGE_ROOT: root }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

export async function runTest(spec) {
  return runChallengeCommand(spec.root, spec.commands.test);
}

export async function runScore(spec) {
  const scorePath = join(spec.root, "score.json");
  await rm(scorePath, { force: true });
  const commandResult = await runChallengeCommand(spec.root, spec.commands.score);
  if (commandResult.exitCode !== 0) {
    throw new Error(`score command failed\n${commandResult.stderr || commandResult.stdout}`);
  }

  const rawScore = JSON.parse(await readFile(scorePath, "utf8"));
  if (typeof rawScore.score !== "number") {
    throw new Error("score.json must contain numeric score");
  }
  if (!rawScore.metrics || typeof rawScore.metrics !== "object") {
    throw new Error("score.json must contain metrics object");
  }

  return {
    score: rawScore.score,
    metrics: rawScore.metrics,
    stdout: commandResult.stdout,
    stderr: commandResult.stderr
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test packages/core/test/runner.test.js
```

Expected:

```text
pass
```

---

### Task 5: Leaderboard Ranking

**Files:**
- Create: `packages/core/src/leaderboard.js`
- Create: `packages/core/test/leaderboard.test.js`

- [ ] **Step 1: Write failing tests in `packages/core/test/leaderboard.test.js`**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { rankRuns } from "../src/leaderboard.js";

test("rankRuns sorts minimize scores ascending", () => {
  const ranked = rankRuns(
    { score: { direction: "minimize" } },
    [{ id: "slow", score: 9 }, { id: "fast", score: 3 }]
  );
  assert.deepEqual(ranked.map((run) => run.id), ["fast", "slow"]);
});

test("rankRuns sorts maximize scores descending", () => {
  const ranked = rankRuns(
    { score: { direction: "maximize" } },
    [{ id: "low", score: 2 }, { id: "high", score: 8 }]
  );
  assert.deepEqual(ranked.map((run) => run.id), ["high", "low"]);
});

test("rankRuns puts promoted verified runs before local runs with same score", () => {
  const ranked = rankRuns(
    { score: { direction: "minimize" } },
    [
      { id: "local", status: "local", score: 3 },
      { id: "promoted", status: "promoted", score: 3 }
    ]
  );
  assert.equal(ranked[0].id, "promoted");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test packages/core/test/leaderboard.test.js
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Implement `packages/core/src/leaderboard.js`**

```js
const statusRank = {
  replicated: 4,
  promoted: 3,
  verified: 2,
  accepted: 1,
  local: 0
};

export function rankRuns(spec, runs) {
  const direction = spec.score.direction;
  return [...runs].sort((a, b) => {
    if (a.score !== b.score) {
      return direction === "minimize" ? a.score - b.score : b.score - a.score;
    }
    return (statusRank[b.status] ?? 0) - (statusRank[a.status] ?? 0);
  });
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test packages/core/test/leaderboard.test.js
```

Expected:

```text
pass
```

---

### Task 6: Verification Receipts

**Files:**
- Create: `packages/core/src/receipts.js`
- Create: `packages/core/test/receipts.test.js`

- [ ] **Step 1: Write failing tests in `packages/core/test/receipts.test.js`**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createReceipt, verifyReceipt } from "../src/receipts.js";

test("createReceipt returns a verifiable local receipt", () => {
  const receipt = createReceipt({
    challengeId: "toyfail",
    challengeVersion: "0.1.0",
    runId: "run_1",
    score: 10,
    metrics: { time_ms: 10 },
    verifier: "local"
  });

  assert.equal(receipt.challengeId, "toyfail");
  assert.equal(verifyReceipt(receipt), true);
});

test("verifyReceipt rejects tampered score", () => {
  const receipt = createReceipt({
    challengeId: "toyfail",
    challengeVersion: "0.1.0",
    runId: "run_1",
    score: 10,
    metrics: { time_ms: 10 },
    verifier: "local"
  });

  receipt.score = 1;
  assert.equal(verifyReceipt(receipt), false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test packages/core/test/receipts.test.js
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Implement `packages/core/src/receipts.js`**

```js
import { createHash } from "node:crypto";

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(payload) {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export function createReceipt(input) {
  const body = {
    createdAt: new Date().toISOString(),
    challengeId: input.challengeId,
    challengeVersion: input.challengeVersion,
    runId: input.runId,
    score: input.score,
    metrics: input.metrics,
    verifier: input.verifier
  };

  return {
    ...body,
    receiptHash: digest(body)
  };
}

export function verifyReceipt(receipt) {
  const { receiptHash, ...body } = receipt;
  return digest(body) === receiptHash;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
node --test packages/core/test/receipts.test.js
```

Expected:

```text
pass
```

---

### Task 7: CLI Router

**Files:**
- Create: `packages/core/src/cli.js`

- [ ] **Step 1: Implement `packages/core/src/cli.js`**

```js
#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadChallengeSpec } from "./spec.js";
import { runScore, runTest } from "./runner.js";
import { appendNote, appendRun, listNotes, listRuns } from "./store.js";
import { rankRuns } from "./leaderboard.js";
import { createReceipt } from "./receipts.js";
import { exportReport } from "./report.js";

function printHelp(cliName) {
  console.log(`Usage: ${cliName} <command>

Commands:
  run                       Run tests, score, store local run
  test                      Run public tests only
  score                     Run score command only
  leaderboard               Show local leaderboard
  notes add <text>          Add local note
  notes search <query>      Search local notes
  export-site               Export local static leaderboard
  help                      Show this help
`);
}

function getChallengeRoot() {
  return process.env.BENCHFORGE_CHALLENGE_ROOT || process.cwd();
}

async function main(argv = process.argv) {
  const spec = await loadChallengeSpec(getChallengeRoot());
  const cliName = spec.cli;
  const [command, subcommand, ...rest] = argv.slice(2);

  if (!command || command === "help") {
    printHelp(cliName);
    return;
  }

  if (command === "test") {
    const result = await runTest(spec);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
    return;
  }

  if (command === "score") {
    const score = await runScore(spec);
    console.log(JSON.stringify({ score: score.score, metrics: score.metrics }, null, 2));
    return;
  }

  if (command === "run") {
    const testResult = await runTest(spec);
    process.stdout.write(testResult.stdout);
    process.stderr.write(testResult.stderr);
    if (testResult.exitCode !== 0) {
      process.exitCode = testResult.exitCode;
      return;
    }

    const scoreResult = await runScore(spec);
    const run = await appendRun(spec.root, {
      challengeId: spec.id,
      challengeVersion: spec.version,
      status: "local",
      score: scoreResult.score,
      metrics: scoreResult.metrics
    });
    const receipt = createReceipt({
      challengeId: spec.id,
      challengeVersion: spec.version,
      runId: run.id,
      score: run.score,
      metrics: run.metrics,
      verifier: "local"
    });
    await writeFile(join(spec.root, ".benchforge", `${run.id}.receipt.json`), JSON.stringify(receipt, null, 2));
    console.log(`${cliName}: local run ${run.id}`);
    console.log(`${cliName}: score ${run.score}`);
    return;
  }

  if (command === "leaderboard") {
    const runs = rankRuns(spec, await listRuns(spec.root));
    if (runs.length === 0) {
      console.log(`${cliName}: no local runs yet`);
      return;
    }
    for (const [index, run] of runs.entries()) {
      console.log(`${index + 1}. ${run.score} ${run.status} ${run.id}`);
    }
    return;
  }

  if (command === "notes" && subcommand === "add") {
    const text = rest.join(" ").trim();
    if (!text) throw new Error("notes add requires text");
    const note = await appendNote(spec.root, { challengeId: spec.id, text });
    console.log(`${cliName}: added note ${note.id}`);
    return;
  }

  if (command === "notes" && subcommand === "search") {
    const query = rest.join(" ").trim();
    const notes = await listNotes(spec.root, query);
    for (const note of notes) {
      console.log(`${note.id} ${note.createdAt} ${note.text}`);
    }
    return;
  }

  if (command === "export-site") {
    const outputPath = await exportReport(spec, await listRuns(spec.root));
    console.log(`${cliName}: exported ${outputPath}`);
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Run CLI before report module exists to verify next failure**

Run:

```bash
node packages/core/src/cli.js help
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

This confirms Task 8 must add `report.js`.

---

### Task 8: Static Report Export

**Files:**
- Create: `packages/core/src/report.js`

- [ ] **Step 1: Implement `packages/core/src/report.js`**

```js
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { rankRuns } from "./leaderboard.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function exportReport(spec, runs) {
  const ranked = rankRuns(spec, runs);
  const outputDir = join(spec.root, ".benchforge", "site");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, "index.html");

  const rows = ranked.map((run, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(run.score)}</td>
      <td>${escapeHtml(run.status)}</td>
      <td>${escapeHtml(run.id)}</td>
      <td>${escapeHtml(run.createdAt)}</td>
    </tr>
  `).join("");

  await writeFile(outputPath, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(spec.name)} Leaderboard</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 40px; color: #1f2923; background: #f7f7f1; }
    h1 { font-size: 40px; margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; background: white; }
    th, td { border-bottom: 1px solid #d9d9ce; padding: 12px; text-align: left; }
    th { color: #65736b; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>${escapeHtml(spec.name)}</h1>
  <p>Local leaderboard. Public leaderboards should use verified or promoted runs.</p>
  <table>
    <thead><tr><th>#</th><th>Score</th><th>Status</th><th>Run</th><th>Created</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`, "utf8");

  return outputPath;
}
```

- [ ] **Step 2: Run all existing tests**

Run:

```bash
npm test
```

Expected:

```text
pass
```

---

### Task 9: Toyfail Challenge Pack

**Files:**
- Create: `challenges/toyfail/bin/toyfail.js`
- Create: `challenges/toyfail/challenge.json`
- Create: `challenges/toyfail/starter/solution.js`
- Create: `challenges/toyfail/harness/test.js`
- Create: `challenges/toyfail/harness/score.js`
- Create: `challenges/toyfail/README.md`
- Create: `challenges/toyfail/SKILL.md`

- [ ] **Step 1: Create branded wrapper `challenges/toyfail/bin/toyfail.js`**

```js
#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
process.env.BENCHFORGE_CHALLENGE_ROOT = resolve(here, "..");
await import("../../../packages/core/src/cli.js");
```

- [ ] **Step 2: Create `challenges/toyfail/challenge.json`**

```json
{
  "id": "toyfail",
  "name": "Toyfail",
  "cli": "toyfail",
  "version": "0.1.0",
  "score": {
    "direction": "minimize",
    "primaryMetric": "time_ms",
    "secondaryMetrics": ["correctness_cases", "checksum"]
  },
  "editablePaths": ["starter/solution.js"],
  "forbiddenPaths": ["harness/**", "challenge.json"],
  "commands": {
    "test": "node harness/test.js",
    "score": "node harness/score.js"
  }
}
```

- [ ] **Step 3: Create starter solution `challenges/toyfail/starter/solution.js`**

```js
export function solve(input) {
  const output = [];
  for (const value of input) {
    if (value % 3 === 0 || value % 5 === 0) {
      output.push(value * value + 17);
    } else {
      output.push(value + 11);
    }
  }
  return output;
}
```

- [ ] **Step 4: Create correctness harness `challenges/toyfail/harness/test.js`**

```js
import assert from "node:assert/strict";
import { solve } from "../starter/solution.js";

function reference(input) {
  return input.map((value) => {
    if (value % 3 === 0 || value % 5 === 0) {
      return value * value + 17;
    }
    return value + 11;
  });
}

function makeCase(seed, size) {
  let state = seed >>> 0;
  const values = [];
  for (let i = 0; i < size; i += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    values.push(state % 1000003);
  }
  return values;
}

let cases = 0;
for (let seed = 1; seed <= 64; seed += 1) {
  const input = makeCase(seed, 256);
  assert.deepEqual(solve(input), reference(input));
  cases += 1;
}

console.log(`toyfail: ${cases} public correctness cases passed`);
```

- [ ] **Step 5: Create score harness `challenges/toyfail/harness/score.js`**

```js
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { solve } from "../starter/solution.js";

function makeInput(size) {
  let state = 123456789;
  const values = [];
  for (let i = 0; i < size; i += 1) {
    state = (1103515245 * state + 12345) >>> 0;
    values.push(state % 1000003);
  }
  return values;
}

const input = makeInput(200000);
let checksum = 0;
const samples = [];

for (let run = 0; run < 7; run += 1) {
  const started = performance.now();
  const output = solve(input);
  const elapsed = performance.now() - started;
  samples.push(elapsed);
  checksum ^= output[(run * 9973) % output.length] >>> 0;
}

samples.sort((a, b) => a - b);
const median = samples[Math.floor(samples.length / 2)];

writeFileSync("score.json", JSON.stringify({
  score: median,
  metrics: {
    time_ms: median,
    correctness_cases: 64,
    checksum
  }
}, null, 2));
```

- [ ] **Step 6: Create `challenges/toyfail/README.md`**

```markdown
# Toyfail

Toyfail is the first Benchforge demo challenge.

Goal: make `starter/solution.js` faster without changing behavior.

Allowed edits:

- `starter/solution.js`

Run:

```bash
npm run toyfail:run
npm run toyfail:leaderboard
npm run toyfail:report
```

Local scores are useful for iteration. Public trust requires an independent verifier.
```

- [ ] **Step 7: Create `challenges/toyfail/SKILL.md`**

```markdown
# Toyfail Agent Skill

You are working on Toyfail, a local-first Benchforge challenge.

Objective: minimize `time_ms` while preserving the behavior of `starter/solution.js`.

Editable files:

- `starter/solution.js`

Do not edit:

- `harness/`
- `challenge.json`
- `.benchforge/` except through the CLI

Commands:

```bash
npm run toyfail:run
npm run toyfail:leaderboard
npm run toyfail:report
```

When an approach fails, add a note:

```bash
node ./challenges/toyfail/bin/toyfail.js notes add "Describe the failed approach and why it failed"
```

Only trust a score after tests pass and the CLI records a run.
```

- [ ] **Step 8: Verify toyfail works**

Run:

```bash
npm run toyfail:run
npm run toyfail:leaderboard
npm run toyfail:report
```

Expected:

```text
toyfail: 64 public correctness cases passed
toyfail: local run run_...
toyfail: score ...
1. ... local run_...
toyfail: exported .../.benchforge/site/index.html
```

---

### Task 10: Generic Benchforge Skill

**Files:**
- Create: `skills/benchforge/SKILL.md`

- [ ] **Step 1: Create `skills/benchforge/SKILL.md`**

```markdown
# Benchforge Skill

Use this skill when working inside a Benchforge benchmark challenge.

## Workflow

1. Read `challenge.json`.
2. Identify `editablePaths` and `forbiddenPaths`.
3. Inspect the current local leaderboard.
4. Run the benchmark before changing code.
5. Make one focused change inside allowed paths.
6. Run the benchmark again.
7. Keep the change only if correctness passes and score improves.
8. Add notes for failed approaches that future agents should avoid.

## Commands

Use the branded CLI for the challenge:

```bash
<challenge-cli> run
<challenge-cli> leaderboard
<challenge-cli> notes search "<query>"
<challenge-cli> notes add "<note>"
<challenge-cli> export-site
```

## Trust Model

Local runs are not public proof. A public leaderboard should use verified or promoted runs produced by a trusted verifier.

## Safety

Never edit paths listed in `forbiddenPaths`.
Never report a score unless the CLI produced it.
Never treat notes as validation evidence.
```

- [ ] **Step 2: Verify skill is readable**

Run:

```bash
sed -n '1,220p' skills/benchforge/SKILL.md
```

Expected:

```text
# Benchforge Skill
```

---

### Task 11: GitHub Actions Verification Baseline

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Create `.github/workflows/test.yml`**

```yaml
name: Test

on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm test
      - run: npm run toyfail:run
      - run: npm run toyfail:leaderboard
```

- [ ] **Step 2: Verify workflow syntax locally by reading it**

Run:

```bash
sed -n '1,160p' .github/workflows/test.yml
```

Expected:

```text
name: Test
```

---

### Task 12: Public Repo Readiness

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update `README.md` with public positioning**

Replace `README.md` with:

```markdown
# Benchforge

Benchforge is a local-first factory for benchmark arenas.

It helps you build public challenges like ECDSA.fail-style arenas:

- a challenge-specific CLI
- local benchmark execution
- local notes for agents
- local leaderboard exports
- verifier receipts
- a path to hosted leaderboards

## The Important Trust Rule

Local scores are useful for iteration, but they are not public proof.

For public leaderboards, Benchforge is designed around candidate submissions that are reproduced by an independent verifier and then marked as verified, promoted, or replicated.

## Quick Start

```bash
npm test
npm run toyfail:run
npm run toyfail:leaderboard
npm run toyfail:report
```

Open the exported report:

```text
challenges/toyfail/.benchforge/site/index.html
```

## Branded CLIs

Each challenge can have its own CLI:

```bash
toyfail run
rckfail run
grpoarena run
```

Those commands are real executables. They load the shared Benchforge engine with a specific challenge pack, so the benchmark behavior comes from that pack's spec and harness.

## Current Status

This repository starts with a local-first MVP:

- shared core engine
- `toyfail` demo challenge
- local notes
- local leaderboard
- local static report
- GitHub Actions test baseline

Cloudflare hosted leaderboards and external verifier runners are the next layer.
```

- [ ] **Step 2: Update `docs/architecture.md` with trust tiers**

Append:

```markdown
## Trust Tiers

```text
local
  Produced by the submitter's machine.

accepted
  Submission format is valid.

verified
  Reproduced by one trusted verifier.

promoted
  Shown on the main leaderboard.

replicated
  Reproduced by multiple verifier environments.
```

The MVP implements local runs and local receipts. Hosted verification will add accepted, verified, promoted, and replicated states.
```

- [ ] **Step 3: Run final verification**

Run:

```bash
npm test
npm run toyfail:run
npm run toyfail:leaderboard
npm run toyfail:report
```

Expected:

```text
tests pass
toyfail creates at least one local run
leaderboard shows at least one row
static report exports to challenges/toyfail/.benchforge/site/index.html
```

---

## Self-Review

Spec coverage:

- Local-first mode: Tasks 3, 7, 8, 9.
- Branded real CLI: Tasks 7 and 9.
- Notes: Tasks 3, 7, 10.
- Leaderboard: Tasks 5, 7, 8.
- Verification receipts: Task 6.
- GitHub Actions path: Task 11.
- Public repo documentation: Tasks 1 and 12.
- RCKangaroo-MT adapter: intentionally deferred until the factory loop works.
- Cloudflare hosted mode: intentionally deferred until local loop and GitHub Actions baseline are stable.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified code steps.
- Deferred items are explicitly outside MVP scope.

Type consistency:

- Challenge spec uses `primaryMetric`, `editablePaths`, `forbiddenPaths`, and `commands`.
- CLI, tests, and toy challenge use the same property names.
- Runs use `id`, `createdAt`, `challengeId`, `challengeVersion`, `status`, `score`, and `metrics`.

