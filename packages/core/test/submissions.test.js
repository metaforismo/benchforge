import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSubmission,
  isPathAllowed,
  listEditableFiles,
  verifySubmission
} from "../src/submissions.js";
import { listRuns, listSubmissions } from "../src/store.js";

async function createTempChallenge() {
  const root = await mkdtemp(join(tmpdir(), "benchforge-submission-"));
  await mkdir(join(root, "starter"), { recursive: true });
  await mkdir(join(root, "harness"), { recursive: true });
  await writeFile(join(root, "starter", "solution.js"), `
    exports.solve = function solve(values) {
      return values.map((value) => value + 1);
    };
  `);
  await writeFile(join(root, "harness", "test.js"), `
    const assert = require("node:assert/strict");
    const { solve } = require("../starter/solution.js");
    assert.deepEqual(solve([1, 2, 3]), [2, 3, 4]);
    console.log("ok");
  `);
  await writeFile(join(root, "harness", "score.js"), `
    const { writeFileSync } = require("node:fs");
    const { solve } = require("../starter/solution.js");
    const started = Date.now();
    const result = solve([1, 2, 3, 4]);
    writeFileSync("score.json", JSON.stringify({
      score: Date.now() - started + result.length,
      metrics: { time_ms: Date.now() - started + result.length, correctness_cases: 1 }
    }));
  `);

  return {
    id: "tmpfail",
    name: "Tmpfail",
    cli: "tmpfail",
    version: "0.1.0",
    root,
    score: { direction: "minimize", primaryMetric: "time_ms" },
    editablePaths: ["starter/solution.js"],
    forbiddenPaths: ["harness/**"],
    commands: { test: "node harness/test.js", score: "node harness/score.js" }
  };
}

test("isPathAllowed matches exact files and directory globs", () => {
  assert.equal(isPathAllowed("starter/solution.js", ["starter/solution.js"]), true);
  assert.equal(isPathAllowed("src/a/b.js", ["src/**"]), true);
  assert.equal(isPathAllowed("harness/test.js", ["starter/**"]), false);
  assert.throws(() => isPathAllowed("../secret", ["../secret"]), /unsafe relative path/);
});

test("listEditableFiles returns normalized editable files", async () => {
  const spec = await createTempChallenge();
  const files = await listEditableFiles(spec.root, spec.editablePaths);
  assert.deepEqual(files, ["starter/solution.js"]);
});

test("createSubmission packages editable files and records candidate", async () => {
  const spec = await createTempChallenge();
  const submission = await createSubmission(spec, {
    score: 7,
    metrics: { time_ms: 7 }
  });

  const manifest = JSON.parse(await readFile(join(submission.path, "submission.json"), "utf8"));
  const copiedSolution = await readFile(join(submission.path, "files", "starter", "solution.js"), "utf8");
  const submissions = await listSubmissions(spec.root);

  assert.equal(manifest.status, "candidate");
  assert.match(copiedSolution, /exports.solve/);
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].id, submission.id);
});

test("verifySubmission runs public checks from a packaged candidate", async () => {
  const spec = await createTempChallenge();
  const submission = await createSubmission(spec, {
    score: 7,
    metrics: { time_ms: 7 }
  });

  const result = await verifySubmission(spec, submission.id);
  const runs = await listRuns(spec.root);
  const submissions = await listSubmissions(spec.root);

  assert.equal(result.submission.status, "accepted");
  assert.equal(result.run.status, "accepted");
  assert.equal(runs.length, 1);
  assert.equal(submissions[0].acceptedRunId, result.run.id);
});
