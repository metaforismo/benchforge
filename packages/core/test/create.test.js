import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChallenge } from "../src/create.js";

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
  assert.deepEqual(challengeJson.editablePaths, ["starter/solution.js"]);
  assert.match(wrapper, /BENCHFORGE_CHALLENGE_ROOT/);
  assert.match(skill, /GRPO Arena Agent Skill/);
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
