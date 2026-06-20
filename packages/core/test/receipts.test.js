import test from "node:test";
import assert from "node:assert/strict";
import { createReceipt, verifyReceipt } from "../src/receipts.js";

test("createReceipt returns a verifiable local receipt", () => {
  const receipt = createReceipt({
    challengeId: "toyfail",
    challengeVersion: "0.1.0",
    runId: "run_1",
    score: 10,
    metrics: { time_ms: 10 },
    verifier: "local"
  });

  assert.equal(receipt.challengeId, "toyfail");
  assert.equal(verifyReceipt(receipt), true);
});

test("verifyReceipt rejects tampered score", () => {
  const receipt = createReceipt({
    challengeId: "toyfail",
    challengeVersion: "0.1.0",
    runId: "run_1",
    score: 10,
    metrics: { time_ms: 10 },
    verifier: "local"
  });

  receipt.score = 1;
  assert.equal(verifyReceipt(receipt), false);
});
