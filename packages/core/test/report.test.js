import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLeaderboardData } from "../src/leaderboard-data.js";
import { exportReport } from "../src/report.js";

function spec(root) {
  return {
    id: "reportfail",
    name: "Report Fail",
    version: "0.1.0",
    root,
    score: {
      direction: "minimize",
      primaryMetric: "time_ms"
    }
  };
}

test("buildLeaderboardData separates public and local best scores", () => {
  const data = buildLeaderboardData(
    spec("/tmp/reportfail"),
    [
      { id: "run_local", status: "local", score: 1, metrics: { time_ms: 1 }, createdAt: "2026-01-02T00:00:00.000Z", sourceSubmissionId: "sub_2" },
      { id: "run_promoted", status: "promoted", score: 3, metrics: { time_ms: 3 }, createdAt: "2026-01-01T00:00:00.000Z", sourceSubmissionId: "sub_1" }
    ],
    [
      { id: "sub_1", files: ["starter/solution.js"], metadata: { solver: "Ada" } },
      { id: "sub_2", files: ["starter/solution.js"], metadata: { model: "Claude Test", note: "faster path" } }
    ]
  );

  assert.equal(data.schemaVersion, "benchforge.leaderboard.v1");
  assert.equal(data.best.any.runId, "run_local");
  assert.equal(data.best.public.runId, "run_promoted");
  assert.equal(data.counts.promoted, 1);
  assert.equal(data.entries[1].files[0], "starter/solution.js");
  assert.equal(data.entries[0].metadata.model, "Claude Test");
  assert.equal(data.entries[0].diff.value, -2);
  assert.equal(data.entries[0].diff.improved, true);
});

test("exportReport writes index.html and leaderboard.json", async () => {
  const root = await mkdtemp(join(tmpdir(), "benchforge-report-"));
  const outputPath = await exportReport(
    spec(root),
    [
      { id: "run_1", status: "promoted", score: 8, metrics: { time_ms: 8 }, createdAt: "2026-01-01T00:00:00.000Z", sourceSubmissionId: "sub_1" }
    ],
    [{
      id: "sub_1",
      files: ["starter/solution.js"],
      metadata: {
        solver: "Ada",
        model: "Claude Test",
        note: "kept the public invariant intact",
        commitUrl: "https://github.com/example/repo/commit/abc"
      }
    }]
  );

  const html = await readFile(outputPath, "utf8");
  const json = JSON.parse(await readFile(join(root, ".benchforge", "site", "leaderboard.json"), "utf8"));

  assert.match(html, /Report Fail/);
  assert.match(html, /Best public score/);
  assert.match(html, /Claude Test/);
  assert.match(html, /View commit/);
  assert.match(html, /kept the public invariant intact/);
  assert.equal(json.best.public.runId, "run_1");
  assert.equal(json.best.public.metadata.commitUrl, "https://github.com/example/repo/commit/abc");
});
