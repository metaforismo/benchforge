import test from "node:test";
import assert from "node:assert/strict";
import {
  addHostedNote,
  fetchHostedLeaderboard,
  hostedConfigFromEnv,
  publishVerifierResult,
  searchHostedNotes
} from "../src/hosted.js";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("hostedConfigFromEnv reads API settings", () => {
  const config = hostedConfigFromEnv({
    BENCHFORGE_API_URL: "https://bench.example",
    BENCHFORGE_API_TOKEN: "secret"
  });
  assert.deepEqual(config, {
    apiUrl: "https://bench.example",
    token: "secret"
  });
});

test("publishVerifierResult posts verifier result to challenge endpoint", async () => {
  const calls = [];
  const result = await publishVerifierResult({
    apiUrl: "https://bench.example/",
    token: "secret",
    result: {
      schemaVersion: "benchforge.verification.v1",
      challenge: { id: "toyfail" }
    }
  }, async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({ accepted: true, runId: "run_1", status: "promoted", score: 3 });
  });

  assert.equal(result.accepted, true);
  assert.equal(calls[0].url, "https://bench.example/api/challenges/toyfail/verifier-results");
  assert.equal(calls[0].init.headers.authorization, "Bearer secret");
});

test("fetchHostedLeaderboard returns hosted JSON", async () => {
  const leaderboard = await fetchHostedLeaderboard({
    apiUrl: "https://bench.example",
    challengeId: "toyfail"
  }, async (url) => {
    assert.equal(url, "https://bench.example/api/challenges/toyfail/leaderboard");
    return jsonResponse({ schemaVersion: "benchforge.leaderboard.v1", entries: [] });
  });

  assert.equal(leaderboard.schemaVersion, "benchforge.leaderboard.v1");
});

test("hosted notes use note endpoints", async () => {
  const added = await addHostedNote({
    apiUrl: "https://bench.example",
    token: "secret",
    challengeId: "toyfail",
    body: "tried x",
    title: "Attempt"
  }, async (url, init) => {
    assert.equal(url, "https://bench.example/api/challenges/toyfail/notes");
    assert.equal(init.headers.authorization, "Bearer secret");
    return jsonResponse({ id: "note_1" }, 201);
  });

  const searched = await searchHostedNotes({
    apiUrl: "https://bench.example",
    challengeId: "toyfail",
    query: "x",
    limit: 3
  }, async (url) => {
    assert.equal(url, "https://bench.example/api/challenges/toyfail/notes?q=x&limit=3");
    return jsonResponse({ notes: [{ id: "note_1" }] });
  });

  assert.equal(added.id, "note_1");
  assert.equal(searched.notes[0].id, "note_1");
});
