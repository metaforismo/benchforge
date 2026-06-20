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
