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
