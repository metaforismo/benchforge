import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../src/cli.js", import.meta.url));

async function createTempChallenge() {
  const root = await mkdtemp(join(tmpdir(), "benchforge-cli-submit-"));
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
  await writeFile(join(root, "challenge.json"), JSON.stringify({
    id: "clickfail",
    name: "Clickfail",
    cli: "clickfail",
    version: "0.1.0",
    score: { direction: "minimize", primaryMetric: "time_ms" },
    editablePaths: ["starter/solution.js"],
    forbiddenPaths: ["harness/**"],
    commands: { test: "node harness/test.js", score: "node harness/score.js" }
  }, null, 2));
  return root;
}

test("setup runs optional challenge setup command", async () => {
  const root = await createTempChallenge();
  const challenge = JSON.parse(await readFile(join(root, "challenge.json"), "utf8"));
  challenge.commands.setup = [process.execPath, "-e", "console.log('setup ok')"];
  await writeFile(join(root, "challenge.json"), JSON.stringify(challenge, null, 2));

  const result = await execFileAsync(process.execPath, [cliPath, "setup"], { cwd: root });
  assert.match(result.stdout, /setup ok/);
});

test("submit --verify packages and verifies a candidate in one command", async () => {
  const root = await createTempChallenge();
  const result = await execFileAsync(process.execPath, [
    cliPath,
    "submit",
    "--verify",
    "--bundle-output",
    ".benchforge/latest.bundle.json",
    "--output",
    ".benchforge/verifier-result.json"
  ], { cwd: root });

  const verifierResult = JSON.parse(await readFile(join(root, ".benchforge", "verifier-result.json"), "utf8"));
  const bundle = JSON.parse(await readFile(join(root, ".benchforge", "latest.bundle.json"), "utf8"));

  assert.match(result.stdout, /clickfail: candidate submission/);
  assert.match(result.stdout, /clickfail: verified accepted run/);
  assert.equal(verifierResult.schemaVersion, "benchforge.verification.v1");
  assert.equal(verifierResult.result.status, "accepted");
  assert.equal(bundle.schemaVersion, "benchforge.submission.v1");
});

test("submissions audit exports a GitHub-friendly directory", async () => {
  const root = await createTempChallenge();
  await execFileAsync(process.execPath, [
    cliPath,
    "submit",
    "--verify",
    "--bundle-output",
    ".benchforge/latest.bundle.json",
    "--output",
    ".benchforge/verifier-result.json"
  ], { cwd: root });

  const result = await execFileAsync(process.execPath, [
    cliPath,
    "submissions",
    "audit",
    "latest",
    "--output",
    ".benchforge/audit-latest"
  ], { cwd: root });
  const readme = await readFile(join(root, ".benchforge", "audit-latest", "README.md"), "utf8");
  const bundle = JSON.parse(await readFile(join(root, ".benchforge", "audit-latest", "submission.bundle.json"), "utf8"));

  assert.match(result.stdout, /clickfail: exported audit submission/);
  assert.match(readme, /Benchforge Submission/);
  assert.equal(bundle.schemaVersion, "benchforge.submission.v1");
});
