import test from "node:test";
import assert from "node:assert/strict";
import { rankRuns } from "../src/leaderboard.js";

test("rankRuns sorts minimize scores ascending", () => {
  const ranked = rankRuns(
    { score: { direction: "minimize" } },
    [{ id: "slow", score: 9 }, { id: "fast", score: 3 }]
  );
  assert.deepEqual(ranked.map((run) => run.id), ["fast", "slow"]);
});

test("rankRuns sorts maximize scores descending", () => {
  const ranked = rankRuns(
    { score: { direction: "maximize" } },
    [{ id: "low", score: 2 }, { id: "high", score: 8 }]
  );
  assert.deepEqual(ranked.map((run) => run.id), ["high", "low"]);
});

test("rankRuns puts promoted verified runs before local runs with same score", () => {
  const ranked = rankRuns(
    { score: { direction: "minimize" } },
    [
      { id: "local", status: "local", score: 3 },
      { id: "promoted", status: "promoted", score: 3 }
    ]
  );
  assert.equal(ranked[0].id, "promoted");
});
