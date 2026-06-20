import { createHash } from "node:crypto";

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(payload) {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export function createReceipt(input) {
  const body = {
    createdAt: new Date().toISOString(),
    challengeId: input.challengeId,
    challengeVersion: input.challengeVersion,
    runId: input.runId,
    score: input.score,
    metrics: input.metrics,
    verifier: input.verifier
  };

  return {
    ...body,
    receiptHash: digest(body)
  };
}

export function verifyReceipt(receipt) {
  const { receiptHash, ...body } = receipt;
  return digest(body) === receiptHash;
}
