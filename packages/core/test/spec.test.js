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
    commands: {
      test: "node harness/test.js",
      verify: "node harness/hidden.js",
      score: "node harness/score.js"
    }
  };

  const validated = validateChallengeSpec(spec);
  assert.equal(validated.id, "toyfail");
  assert.equal(validated.commands.verify, "node harness/hidden.js");
});

test("validateChallengeSpec accepts ECDSA-style benchmark.json specs", () => {
  const validated = validateChallengeSpec({
    schemaVersion: 1,
    name: "ecadd-challenge-test",
    description: "Optimize a benchmark.",
    category: "rust",
    direction: "-",
    editablePaths: ["src/point_add"],
    setupCommand: ["bash", "-lc", "./setup.sh"],
    benchmarkCommand: ["bash", "-lc", "./benchmark.sh"],
    scorePath: "score.json"
  });

  assert.equal(validated.id, "ecadd-challenge-test");
  assert.equal(validated.cli, "ecadd-challenge-test");
  assert.equal(validated.score.direction, "minimize");
  assert.equal(validated.score.primaryMetric, "score");
  assert.deepEqual(validated.commands.score, ["bash", "-lc", "./benchmark.sh"]);
  assert.deepEqual(validated.commands.test, ["bash", "-lc", "./benchmark.sh"]);
  assert.equal(validated.scorePath, "score.json");
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
    /commands.score must be a non-empty string or string array/
  );
});

test("loadChallengeSpec falls back to benchmark.json", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-benchmark-spec-"));
  await writeFile(join(root, "benchmark.json"), JSON.stringify({
    name: "Tiny Bench",
    direction: "+",
    editablePaths: ["solution.js"],
    benchmarkCommand: ["node", "bench.js"],
    scorePath: "out/score.json"
  }));

  const spec = await loadChallengeSpec(root);
  assert.equal(spec.id, "tiny-bench");
  assert.equal(spec.configFile, "benchmark.json");
  assert.equal(spec.configFormat, "benchmark");
  assert.equal(spec.score.direction, "maximize");
  assert.deepEqual(spec.commands.score, ["node", "bench.js"]);
  assert.equal(spec.scorePath, "out/score.json");
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
  assert.equal(spec.configFile, "challenge.json");
});
