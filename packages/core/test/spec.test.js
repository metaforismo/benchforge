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
