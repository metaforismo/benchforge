import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createChallenge } from "../src/create.js";

const execFileAsync = promisify(execFile);

test("createChallenge creates a branded challenge pack", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-create-"));
  const created = await createChallenge({
    id: "grpoarena",
    name: "GRPO Arena",
    root
  });

  const challengeJson = JSON.parse(await readFile(join(root, "challenges", "grpoarena", "challenge.json"), "utf8"));
  const wrapper = await readFile(join(root, "challenges", "grpoarena", "bin", "grpoarena.js"), "utf8");
  const skill = await readFile(join(root, "challenges", "grpoarena", "SKILL.md"), "utf8");

  assert.equal(created.cli, "grpoarena");
  assert.equal(challengeJson.name, "GRPO Arena");
  assert.equal(challengeJson.scorePath, "score.json");
  assert.deepEqual(challengeJson.editablePaths, ["starter/solution.js"]);
  assert.match(wrapper, /BENCHFORGE_CHALLENGE_ROOT/);
  assert.match(skill, /^---\nname: grpoarena/m);
  assert.match(skill, /GRPO Arena Agent Skill/);
});

test("createChallenge wrappers run outside the Benchforge repo", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-create-run-"));
  await createChallenge({
    id: "standalone-ish",
    name: "Standalone Ish",
    root
  });

  const wrapper = join(root, "challenges", "standalone-ish", "bin", "standalone-ish.js");
  const result = await execFileAsync(process.execPath, [wrapper, "run"], { cwd: root });

  assert.match(result.stdout, /standalone-ish: 32 public correctness cases passed/);
  assert.match(result.stdout, /standalone-ish: local run/);
});

test("createChallenge wrappers stay portable inside a Benchforge repo", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-create-portable-"));
  await mkdir(join(root, "packages", "core", "src"), { recursive: true });
  await writeFile(join(root, "packages", "core", "src", "cli.js"), "");

  await createChallenge({
    id: "portable-ish",
    name: "Portable Ish",
    root
  });

  const wrapper = await readFile(join(root, "challenges", "portable-ish", "bin", "portable-ish.js"), "utf8");
  assert.equal(wrapper.includes(process.cwd()), false);
  assert.match(wrapper, /\.\.\/\.\.\/\.\.\/packages\/core\/src\/cli\.js/);
});

test("createChallenge supports separate cli name", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-create-cli-"));
  const created = await createChallenge({
    id: "ppo-research",
    cli: "ppoarena",
    root
  });

  const challengeJson = JSON.parse(await readFile(join(root, "challenges", "ppo-research", "challenge.json"), "utf8"));
  const wrapper = await readFile(join(root, "challenges", "ppo-research", "bin", "ppoarena.js"), "utf8");

  assert.equal(created.name, "Ppo Research");
  assert.equal(challengeJson.cli, "ppoarena");
  assert.match(wrapper, /packages\/core\/src\/cli.js/);
});

test("createChallenge rejects duplicate challenge directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-create-dupe-"));
  await createChallenge({ id: "dupefail", root });

  await assert.rejects(
    () => createChallenge({ id: "dupefail", root }),
    /challenge already exists/
  );
});

test("createChallenge rejects unsafe identifiers", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-create-bad-"));
  await assert.rejects(
    () => createChallenge({ id: "../bad", root }),
    /id must match/
  );
  await assert.rejects(
    () => createChallenge({ id: "good", cli: "../bad", root }),
    /cli must match/
  );
});
