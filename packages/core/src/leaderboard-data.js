import { rankRuns } from "./leaderboard.js";

const publicStatuses = new Set(["verified", "promoted", "replicated"]);

function compareScores(spec, next, current) {
  if (!current) return true;
  return spec.score.direction === "minimize" ? next < current : next > current;
}

export function buildLeaderboardData(spec, runs, submissions = []) {
  const ranked = rankRuns(spec, runs);
  const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
  const entries = ranked.map((run, index) => {
    const submission = run.sourceSubmissionId ? submissionById.get(run.sourceSubmissionId) : null;
    return {
      rank: index + 1,
      runId: run.id,
      submissionId: run.sourceSubmissionId ?? null,
      status: run.status,
      score: run.score,
      metrics: run.metrics,
      createdAt: run.createdAt,
      challengeVersion: run.challengeVersion,
      trusted: publicStatuses.has(run.status),
      files: submission?.files ?? []
    };
  });

  const publicEntries = entries.filter((entry) => entry.trusted);
  const bestPublic = publicEntries[0] ?? null;
  const bestAny = entries[0] ?? null;

  let bestScore = null;
  const history = [...entries]
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((entry) => {
      if (compareScores(spec, entry.score, bestScore)) {
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
      id: spec.id,
      name: spec.name,
      version: spec.version,
      scoreDirection: spec.score.direction,
      primaryMetric: spec.score.primaryMetric
    },
    counts: {
      runs: entries.length,
      local: entries.filter((entry) => entry.status === "local").length,
      accepted: entries.filter((entry) => entry.status === "accepted").length,
      verified: entries.filter((entry) => entry.status === "verified").length,
      promoted: entries.filter((entry) => entry.status === "promoted").length,
      replicated: entries.filter((entry) => entry.status === "replicated").length,
      submissions: submissions.length
    },
    best: {
      public: bestPublic,
      any: bestAny
    },
    entries,
    history
  };
}
