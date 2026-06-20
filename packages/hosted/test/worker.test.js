import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim().toLowerCase();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async run() {
    return this.db.run(this.sql, this.args);
  }

  async all() {
    return this.db.all(this.sql, this.args);
  }

  async first() {
    return this.db.first(this.sql, this.args);
  }
}

class FakeD1 {
  constructor() {
    this.challenges = new Map();
    this.submissions = new Map();
    this.runs = new Map();
    this.verifierResults = new Map();
    this.notes = new Map();
    this.events = new Map();
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async run(sql, args) {
    if (sql.startsWith("insert into challenges")) {
      const [id, name, version, score_direction, primary_metric, updated_at] = args;
      this.challenges.set(id, { id, name, version, score_direction, primary_metric, updated_at });
      return { success: true };
    }
    if (sql.startsWith("insert into submissions")) {
      const [id, challenge_id, status, candidate_score, candidate_metrics_json, files_json, created_at, updated_at] = args;
      this.submissions.set(id, { id, challenge_id, status, candidate_score, candidate_metrics_json, files_json, created_at, updated_at });
      return { success: true };
    }
    if (sql.startsWith("insert into runs")) {
      const [id, challenge_id, submission_id, status, score, metrics_json, verifier_kind, verifier_trusted, receipt_hash, created_at] = args;
      this.runs.set(id, { id, challenge_id, submission_id, status, score, metrics_json, verifier_kind, verifier_trusted, receipt_hash, created_at });
      return { success: true };
    }
    if (sql.startsWith("insert into verifier_results")) {
      const [run_id, challenge_id, submission_id, payload_json, created_at] = args;
      this.verifierResults.set(run_id, { run_id, challenge_id, submission_id, payload_json, created_at });
      return { success: true };
    }
    if (sql.startsWith("insert into notes")) {
      const [id, challenge_id, title, body, author, created_at] = args;
      this.notes.set(id, { id, challenge_id, title, body, author, created_at });
      return { success: true };
    }
    if (sql.startsWith("insert into cli_events")) {
      const [id, challenge_id, event_name, payload_json, created_at] = args;
      this.events.set(id, { id, challenge_id, event_name, payload_json, created_at });
      return { success: true };
    }
    throw new Error(`unhandled run SQL: ${sql}`);
  }

  async all(sql, args) {
    if (sql.startsWith("select * from challenges")) {
      return { results: [...this.challenges.values()].sort((left, right) => right.updated_at.localeCompare(left.updated_at)) };
    }
    if (sql.startsWith("select runs.*")) {
      const [challengeId] = args;
      return {
        results: [...this.runs.values()]
          .filter((run) => run.challenge_id === challengeId)
          .map((run) => ({
            ...run,
            files_json: this.submissions.get(run.submission_id)?.files_json ?? "[]"
          }))
      };
    }
    if (sql.includes("from notes")) {
      const [challengeId, maybeTitle, maybeBody, maybeLimit] = args;
      const limit = maybeLimit ?? args[1];
      let notes = [...this.notes.values()].filter((note) => note.challenge_id === challengeId);
      if (maybeTitle && typeof maybeTitle === "string" && maybeTitle.includes("%")) {
        const query = maybeTitle.replaceAll("%", "");
        notes = notes.filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(query));
      }
      return { results: notes.sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, limit) };
    }
    throw new Error(`unhandled all SQL: ${sql}`);
  }

  async first(sql, args) {
    if (sql.startsWith("select * from challenges where id = ?")) {
      return this.challenges.get(args[0]) ?? null;
    }
    throw new Error(`unhandled first SQL: ${sql}`);
  }
}

function env() {
  return {
    DB: new FakeD1(),
    BENCHFORGE_RUNNER_TOKEN: "secret"
  };
}

function verifierResult(overrides = {}) {
  return {
    schemaVersion: "benchforge.verification.v1",
    createdAt: "2026-06-21T00:00:00.000Z",
    challenge: {
      id: "toyfail",
      name: "Toyfail",
      version: "0.1.0",
      scoreDirection: "minimize",
      primaryMetric: "time_ms"
    },
    submission: {
      id: "sub_1",
      status: "promoted",
      candidateScore: 4,
      candidateMetrics: { time_ms: 4 },
      files: ["starter/solution.js"]
    },
    verifier: {
      kind: "github-actions",
      trusted: true
    },
    result: {
      status: "promoted",
      runId: "run_1",
      score: 3,
      metrics: { time_ms: 3 },
      receiptHash: "abc"
    },
    ...overrides
  };
}

async function request(path, options = {}, testEnv = env()) {
  return worker.fetch(new Request(`https://bench.example${path}`, options), testEnv);
}

test("health endpoint is public", async () => {
  const response = await request("/api/health");
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test("write endpoints require bearer token", async () => {
  const response = await request("/api/challenges/toyfail/verifier-results", {
    method: "POST",
    body: JSON.stringify(verifierResult())
  });
  assert.equal(response.status, 401);
});

test("trusted verifier result ingestion builds leaderboard", async () => {
  const testEnv = env();
  const ingest = await request("/api/challenges/toyfail/verifier-results", {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json"
    },
    body: JSON.stringify(verifierResult())
  }, testEnv);
  assert.equal(ingest.status, 201);
  const ingestBody = await ingest.json();
  assert.equal(ingestBody.status, "promoted");
  assert.equal(ingestBody.promoted, true);

  const leaderboardResponse = await request("/api/challenges/toyfail/leaderboard", {}, testEnv);
  const leaderboard = await leaderboardResponse.json();
  assert.equal(leaderboard.schemaVersion, "benchforge.leaderboard.v1");
  assert.equal(leaderboard.best.public.runId, "run_1");
  assert.equal(leaderboard.entries[0].files[0], "starter/solution.js");
});

test("hosted promotion demotes non-frontier promoted requests", async () => {
  const testEnv = env();
  const headers = {
    authorization: "Bearer secret",
    "content-type": "application/json"
  };

  await request("/api/challenges/toyfail/verifier-results", {
    method: "POST",
    headers,
    body: JSON.stringify(verifierResult({
      submission: { ...verifierResult().submission, id: "sub_fast" },
      result: { ...verifierResult().result, runId: "run_fast", score: 3 }
    }))
  }, testEnv);

  const slower = await request("/api/challenges/toyfail/verifier-results", {
    method: "POST",
    headers,
    body: JSON.stringify(verifierResult({
      submission: { ...verifierResult().submission, id: "sub_slow" },
      result: { ...verifierResult().result, runId: "run_slow", score: 9 }
    }))
  }, testEnv);
  const slowerBody = await slower.json();
  assert.equal(slowerBody.requestedStatus, "promoted");
  assert.equal(slowerBody.status, "verified");
  assert.equal(slowerBody.promoted, false);

  const leaderboardResponse = await request("/api/challenges/toyfail/leaderboard", {}, testEnv);
  const leaderboard = await leaderboardResponse.json();
  assert.equal(leaderboard.counts.promoted, 1);
  assert.equal(leaderboard.counts.verified, 1);
  assert.equal(leaderboard.entries[0].runId, "run_fast");
  assert.equal(leaderboard.entries[1].status, "verified");
});

test("notes can be added and searched", async () => {
  const testEnv = env();
  const created = await request("/api/challenges/toyfail/notes", {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json"
    },
    body: JSON.stringify({ title: "Fast path", body: "vectorized loop", author: "agent" })
  }, testEnv);
  assert.equal(created.status, 201);

  const response = await request("/api/challenges/toyfail/notes?q=vector", {}, testEnv);
  const body = await response.json();
  assert.equal(body.notes.length, 1);
  assert.equal(body.notes[0].title, "Fast path");
});
