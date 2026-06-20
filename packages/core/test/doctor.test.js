import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor } from "../src/doctor.js";

async function createTempChallenge() {
  const root = await mkdtemp(join(tmpdir(), "benchforge-doctor-"));
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
    writeFileSync("score.json", JSON.stringify({
      score: 4,
      metrics: { time_ms: 4, correctness_cases: 1 }
    }));
  `);

  return {
    id: "doctorfail",
    name: "Doctorfail",
    cli: "doctorfail",
    version: "0.1.0",
    root,
    score: { direction: "minimize", primaryMetric: "time_ms" },
    editablePaths: ["starter/solution.js"],
    forbiddenPaths: ["harness/**"],
    hosted: null,
    commands: { test: "node harness/test.js", score: "node harness/score.js" }
  };
}

function byName(report, name) {
  return report.checks.find((item) => item.name === name);
}

test("runDoctor reports useful static challenge checks", async () => {
  const spec = await createTempChallenge();
  const report = await runDoctor(spec);

  assert.equal(report.schemaVersion, "benchforge.doctor.v1");
  assert.equal(report.status, "warn");
  assert.equal(byName(report, "editable-files").status, "pass");
  assert.equal(byName(report, "forbidden-paths").status, "pass");
  assert.equal(byName(report, "verifier-checks").status, "warn");
  assert.equal(byName(report, "hosted-api").status, "warn");
});

test("runDoctor --run executes public tests, verifier checks, and scoring", async () => {
  const spec = await createTempChallenge();
  await writeFile(join(spec.root, "harness", "verify.js"), `
    console.log("hidden ok");
  `);

  const report = await runDoctor({
    ...spec,
    hosted: { apiUrl: "https://benchforge.example" },
    commands: {
      ...spec.commands,
      verify: "node harness/verify.js"
    }
  }, { run: true });

  assert.equal(report.status, "pass");
  assert.equal(byName(report, "public-tests").status, "pass");
  assert.equal(byName(report, "verifier-command").status, "pass");
  assert.equal(byName(report, "score").details.score, 4);
});

test("runDoctor --run fails when verifier-only checks fail", async () => {
  const spec = await createTempChallenge();
  await writeFile(join(spec.root, "harness", "verify.js"), `
    console.error("hidden invariant failed");
    process.exit(17);
  `);

  const report = await runDoctor({
    ...spec,
    commands: {
      ...spec.commands,
      verify: "node harness/verify.js"
    }
  }, { run: true });

  assert.equal(report.status, "fail");
  assert.equal(byName(report, "verifier-command").status, "fail");
  assert.match(byName(report, "verifier-command").details.stderr, /hidden invariant failed/);
});

test("runDoctor fails when an expected repository is configured outside git", async () => {
  const spec = await createTempChallenge();
  const report = await runDoctor({
    ...spec,
    source: {
      repository: "https://github.com/example/challenge"
    }
  });

  assert.equal(report.status, "fail");
  assert.equal(byName(report, "git-context").status, "fail");
  assert.match(byName(report, "git-context").message, /not inside a git repo/);
});
