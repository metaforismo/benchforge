const publicRunStatuses = new Set(["verified", "promoted", "replicated"]);
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function json(value, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "authorization,content-type");
  return new Response(JSON.stringify(value, null, 2), { ...init, headers });
}

function error(status, message, details = null) {
  return json({ error: { message, details } }, { status });
}

function route(url) {
  return url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
}

function clampLimit(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function stringify(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function sha256Bytes(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return new Uint8Array(digest);
}

async function timingSafeEqual(left, right) {
  const leftHash = await sha256Bytes(left);
  const rightHash = await sha256Bytes(right);
  let diff = left.length === right.length ? 0 : 1;
  for (let index = 0; index < leftHash.length; index += 1) {
    diff |= leftHash[index] ^ rightHash[index];
  }
  return diff === 0;
}

function bearerToken(request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function isAuthorized(request, env) {
  if (env.BENCHFORGE_ALLOW_UNAUTHENTICATED_WRITES === "true") {
    return true;
  }
  const expected = env.BENCHFORGE_RUNNER_TOKEN;
  const actual = bearerToken(request);
  if (!expected || !actual) return false;
  return timingSafeEqual(actual, expected);
}

async function requireAuthorized(request, env) {
  if (!await isAuthorized(request, env)) {
    return error(401, "missing or invalid bearer token");
  }
  return null;
}

function assertObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function validateVerifierResult(body, challengeId) {
  assertObject(body, "verifier result");
  if (body.schemaVersion !== "benchforge.verification.v1") {
    throw new Error("schemaVersion must be benchforge.verification.v1");
  }
  if (body.challenge?.id !== challengeId) {
    throw new Error(`challenge.id must match route challenge ${challengeId}`);
  }
  if (body.verifier?.trusted !== true) {
    throw new Error("verifier.trusted must be true for hosted public ingestion");
  }
  if (!publicRunStatuses.has(body.result?.status)) {
    throw new Error("result.status must be verified, promoted, or replicated");
  }
  if (typeof body.result?.score !== "number" || Number.isNaN(body.result.score)) {
    throw new Error("result.score must be a number");
  }
  if (typeof body.result?.runId !== "string" || body.result.runId.length === 0) {
    throw new Error("result.runId is required");
  }
  if (typeof body.submission?.id !== "string" || body.submission.id.length === 0) {
    throw new Error("submission.id is required");
  }
}

async function upsertChallenge(db, result) {
  const challenge = result.challenge;
  await db.prepare(`
    INSERT INTO challenges (id, name, version, score_direction, primary_metric, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      version = excluded.version,
      score_direction = excluded.score_direction,
      primary_metric = excluded.primary_metric,
      updated_at = excluded.updated_at
  `).bind(
    challenge.id,
    challenge.name,
    challenge.version,
    result.challenge.scoreDirection ?? "minimize",
    result.challenge.primaryMetric ?? "score",
    result.createdAt
  ).run();
}

async function upsertSubmission(db, result) {
  await db.prepare(`
    INSERT INTO submissions (
      id, challenge_id, status, candidate_score, candidate_metrics_json, files_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      candidate_score = excluded.candidate_score,
      candidate_metrics_json = excluded.candidate_metrics_json,
      files_json = excluded.files_json,
      updated_at = excluded.updated_at
  `).bind(
    result.submission.id,
    result.challenge.id,
    result.submission.status,
    result.submission.candidateScore ?? null,
    stringify(result.submission.candidateMetrics ?? null),
    stringify(result.submission.files ?? []),
    result.createdAt,
    result.createdAt
  ).run();
}

async function upsertRun(db, result) {
  await db.prepare(`
    INSERT INTO runs (
      id, challenge_id, submission_id, status, score, metrics_json,
      verifier_kind, verifier_trusted, receipt_hash, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      score = excluded.score,
      metrics_json = excluded.metrics_json,
      verifier_kind = excluded.verifier_kind,
      verifier_trusted = excluded.verifier_trusted,
      receipt_hash = excluded.receipt_hash
  `).bind(
    result.result.runId,
    result.challenge.id,
    result.submission.id,
    result.result.status,
    result.result.score,
    stringify(result.result.metrics ?? {}),
    result.verifier.kind,
    result.verifier.trusted ? 1 : 0,
    result.result.receiptHash ?? null,
    result.createdAt
  ).run();
}

async function insertVerifierResult(db, result) {
  await db.prepare(`
    INSERT INTO verifier_results (run_id, challenge_id, submission_id, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      payload_json = excluded.payload_json
  `).bind(
    result.result.runId,
    result.challenge.id,
    result.submission.id,
    stringify(result),
    result.createdAt
  ).run();
}

async function ingestVerifierResult(env, challengeId, body) {
  validateVerifierResult(body, challengeId);
  await upsertChallenge(env.DB, body);
  await upsertSubmission(env.DB, body);
  await upsertRun(env.DB, body);
  await insertVerifierResult(env.DB, body);
  return {
    accepted: true,
    challengeId,
    submissionId: body.submission.id,
    runId: body.result.runId,
    status: body.result.status,
    score: body.result.score
  };
}

function compareRuns(challenge, left, right) {
  if (left.score !== right.score) {
    return challenge.score_direction === "maximize"
      ? right.score - left.score
      : left.score - right.score;
  }
  const statusRank = { replicated: 4, promoted: 3, verified: 2 };
  return (statusRank[right.status] ?? 0) - (statusRank[left.status] ?? 0);
}

async function getChallenge(db, challengeId) {
  return db.prepare("SELECT * FROM challenges WHERE id = ?").bind(challengeId).first();
}

async function listChallenges(db) {
  const result = await db.prepare("SELECT * FROM challenges ORDER BY updated_at DESC").all();
  return result.results ?? [];
}

async function buildLeaderboard(env, challengeId) {
  const challenge = await getChallenge(env.DB, challengeId);
  if (!challenge) {
    return null;
  }

  const runsResult = await env.DB.prepare(`
    SELECT runs.*, submissions.files_json
    FROM runs
    LEFT JOIN submissions ON submissions.id = runs.submission_id
    WHERE runs.challenge_id = ?
  `).bind(challengeId).all();

  const runs = (runsResult.results ?? []).sort((left, right) => compareRuns(challenge, left, right));
  const entries = runs.map((run, index) => ({
    rank: index + 1,
    runId: run.id,
    submissionId: run.submission_id,
    status: run.status,
    score: run.score,
    metrics: parseJson(run.metrics_json, {}),
    createdAt: run.created_at,
    challengeVersion: challenge.version,
    trusted: publicRunStatuses.has(run.status),
    verifier: {
      kind: run.verifier_kind,
      trusted: run.verifier_trusted === 1
    },
    receiptHash: run.receipt_hash,
    files: parseJson(run.files_json, [])
  }));

  let bestScore = null;
  const history = [...entries]
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
    .map((entry) => {
      if (bestScore === null || compareRuns(challenge, { ...entry, status: "verified" }, { score: bestScore, status: "verified" }) < 0) {
        bestScore = entry.score;
      }
      return {
        createdAt: entry.createdAt,
        runId: entry.runId,
        status: entry.status,
        score: entry.score,
        bestScore
      };
    });

  return {
    schemaVersion: "benchforge.leaderboard.v1",
    generatedAt: new Date().toISOString(),
    challenge: {
      id: challenge.id,
      name: challenge.name,
      version: challenge.version,
      scoreDirection: challenge.score_direction,
      primaryMetric: challenge.primary_metric
    },
    counts: {
      runs: entries.length,
      verified: entries.filter((entry) => entry.status === "verified").length,
      promoted: entries.filter((entry) => entry.status === "promoted").length,
      replicated: entries.filter((entry) => entry.status === "replicated").length
    },
    best: {
      public: entries[0] ?? null,
      any: entries[0] ?? null
    },
    entries,
    history
  };
}

async function listNotes(env, challengeId, url) {
  const limit = clampLimit(url.searchParams.get("limit"));
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const result = query
    ? await env.DB.prepare(`
        SELECT * FROM notes
        WHERE challenge_id = ? AND (lower(title) LIKE ? OR lower(body) LIKE ?)
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(challengeId, `%${query}%`, `%${query}%`, limit).all()
    : await env.DB.prepare(`
        SELECT * FROM notes
        WHERE challenge_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(challengeId, limit).all();

  return {
    notes: (result.results ?? []).map((note) => ({
      id: note.id,
      challengeId: note.challenge_id,
      title: note.title,
      body: note.body,
      author: note.author,
      createdAt: note.created_at
    }))
  };
}

async function createNote(env, challengeId, body) {
  assertObject(body, "note");
  const title = String(body.title ?? "Untitled").trim().slice(0, 200);
  const noteBody = String(body.body ?? body.text ?? "").trim();
  if (!noteBody) throw new Error("note body is required");
  if (new TextEncoder().encode(noteBody).byteLength > 16 * 1024) {
    throw new Error("note body must be 16 KiB or smaller");
  }
  const id = `note_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO notes (id, challenge_id, title, body, author, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    challengeId,
    title,
    noteBody,
    String(body.author ?? "anonymous").trim().slice(0, 120),
    createdAt
  ).run();
  return { id, challengeId, title, body: noteBody, createdAt };
}

async function recordCliEvent(env, body) {
  assertObject(body, "event");
  const id = `evt_${crypto.randomUUID()}`;
  await env.DB.prepare(`
    INSERT INTO cli_events (id, challenge_id, event_name, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    id,
    body.challengeId ?? null,
    String(body.event ?? body.name ?? "unknown").slice(0, 120),
    stringify(body),
    new Date().toISOString()
  ).run();
  return { recorded: true, id };
}

async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (writeMethods.has(request.method)) {
    const authError = await requireAuthorized(request, env);
    if (authError) return authError;
  }

  const url = new URL(request.url);
  const parts = route(url);

  if (request.method === "GET" && parts.join("/") === "api/health") {
    return json({ ok: true, service: "benchforge-hosted" });
  }

  if (request.method === "GET" && parts.join("/") === "api/challenges") {
    return json({ challenges: await listChallenges(env.DB) });
  }

  if (parts[0] === "api" && parts[1] === "challenges" && parts[2]) {
    const challengeId = parts[2];

    if (request.method === "GET" && parts[3] === "leaderboard") {
      const leaderboard = await buildLeaderboard(env, challengeId);
      return leaderboard ? json(leaderboard) : error(404, "challenge not found");
    }

    if (request.method === "POST" && parts[3] === "verifier-results") {
      const body = await request.json();
      return json(await ingestVerifierResult(env, challengeId, body), { status: 201 });
    }

    if (request.method === "GET" && parts[3] === "notes") {
      return json(await listNotes(env, challengeId, url));
    }

    if (request.method === "POST" && parts[3] === "notes") {
      const body = await request.json();
      return json(await createNote(env, challengeId, body), { status: 201 });
    }
  }

  if (request.method === "POST" && parts.join("/") === "api/cli/events") {
    return json(await recordCliEvent(env, await request.json()), { status: 202 });
  }

  return error(404, "not found");
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (caught) {
      console.error(JSON.stringify({
        level: "error",
        message: caught?.message ?? String(caught)
      }));
      return error(400, caught?.message ?? "bad request");
    }
  }
};

export const internals = {
  buildLeaderboard,
  ingestVerifierResult,
  timingSafeEqual
};
