import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { runScore, runTest, runVerifierChecks } from "./runner.js";
import { appendRun, appendSubmission, getStoreDir, listSubmissions, updateSubmission } from "./store.js";
import { createReceipt } from "./receipts.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeRelative(path) {
  return path.split(sep).join("/");
}

function assertSafeRelativePath(path) {
  const normalized = normalizeRelative(path);
  if (normalized.startsWith("/") || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`unsafe relative path: ${path}`);
  }
  return normalized;
}

async function walkFiles(root, dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(root, fullPath, files);
    } else if (entry.isFile()) {
      files.push(normalizeRelative(relative(root, fullPath)));
    }
  }
  return files;
}

export function isPathAllowed(path, patterns) {
  const normalized = assertSafeRelativePath(path);
  return patterns.some((pattern) => {
    const safePattern = assertSafeRelativePath(pattern);
    if (safePattern.endsWith("/**")) {
      const prefix = safePattern.slice(0, -3);
      return normalized === prefix || normalized.startsWith(`${prefix}/`);
    }
    return normalized === safePattern;
  });
}

export async function listEditableFiles(root, patterns) {
  const files = [];
  for (const pattern of patterns) {
    if (pattern.endsWith("/**")) {
      const base = join(root, assertSafeRelativePath(pattern.slice(0, -3)));
      files.push(...await walkFiles(root, base));
    } else {
      files.push(assertSafeRelativePath(pattern));
    }
  }
  return [...new Set(files)].sort();
}

async function copyIntoSubmission(root, outputRoot, file) {
  if (!isPathAllowed(file, [file])) {
    throw new Error(`invalid relative path: ${file}`);
  }
  const destination = join(outputRoot, "files", file);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(root, file), destination);
}

export async function createSubmission(spec, scoreResult) {
  const submissionId = `sub_${randomUUID()}`;
  const submissionDir = join(getStoreDir(spec.root), "submissions", submissionId);
  const files = await listEditableFiles(spec.root, spec.editablePaths);
  await mkdir(submissionDir, { recursive: true });

  for (const file of files) {
    if (!isPathAllowed(file, spec.editablePaths)) {
      throw new Error(`editable file escaped allowed paths: ${file}`);
    }
    await copyIntoSubmission(spec.root, submissionDir, file);
  }

  const manifest = {
    id: submissionId,
    createdAt: nowIso(),
    challengeId: spec.id,
    challengeVersion: spec.version,
    status: "candidate",
    score: scoreResult.score,
    metrics: scoreResult.metrics,
    editablePaths: spec.editablePaths,
    files
  };

  await writeFile(join(submissionDir, "submission.json"), JSON.stringify(manifest, null, 2), "utf8");
  return appendSubmission(spec.root, {
    ...manifest,
    id: submissionId,
    path: submissionDir
  });
}

async function latestSubmission(root) {
  const submissions = await listSubmissions(root);
  return submissions.at(-1) ?? null;
}

async function copyChallengeForVerification(spec) {
  const tempRoot = await mkdtemp(join(tmpdir(), `${spec.id}-verify-`));
  await cp(spec.root, tempRoot, {
    recursive: true,
    filter: (source) => {
      const rel = normalizeRelative(relative(spec.root, source));
      return rel !== ".benchforge" && !rel.startsWith(".benchforge/") && rel !== "score.json";
    }
  });
  return tempRoot;
}

async function applySubmissionFiles(tempRoot, submission) {
  for (const file of submission.files) {
    if (!isPathAllowed(file, submission.editablePaths)) {
      throw new Error(`submission contains forbidden path: ${file}`);
    }
    const source = join(submission.path, "files", file);
    const destination = join(tempRoot, file);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }
}

export async function verifySubmission(spec, requestedId = "latest", options = {}) {
  const trusted = options.trusted === true;
  const promoted = options.promote === true;
  const status = trusted ? (promoted ? "promoted" : "verified") : "accepted";
  const verifierKind = options.verifierKind ?? (trusted ? "trusted-runner" : "local-public");
  const submission = requestedId === "latest"
    ? await latestSubmission(spec.root)
    : (await listSubmissions(spec.root)).find((candidate) => candidate.id === requestedId);

  if (!submission) {
    throw new Error("no submission found");
  }

  const manifest = JSON.parse(await readFile(join(submission.path, "submission.json"), "utf8"));
  for (const file of manifest.files) {
    if (!isPathAllowed(file, spec.editablePaths)) {
      throw new Error(`manifest contains forbidden path: ${file}`);
    }
  }

  const tempRoot = await copyChallengeForVerification(spec);
  await applySubmissionFiles(tempRoot, submission);

  const tempSpec = { ...spec, root: tempRoot };
  const testResult = await runTest(tempSpec);
  if (testResult.exitCode !== 0) {
    await updateSubmission(spec.root, submission.id, {
      status: "rejected",
      rejectedAt: nowIso(),
      verifierLog: testResult.stderr || testResult.stdout
    });
    throw new Error(`verification tests failed\n${testResult.stderr || testResult.stdout}`);
  }

  const verifierResult = await runVerifierChecks(tempSpec);
  if (verifierResult.exitCode !== 0) {
    await updateSubmission(spec.root, submission.id, {
      status: "rejected",
      rejectedAt: nowIso(),
      verifierLog: verifierResult.stderr || verifierResult.stdout
    });
    throw new Error(`verifier checks failed\n${verifierResult.stderr || verifierResult.stdout}`);
  }

  const scoreResult = await runScore(tempSpec);
  const run = await appendRun(spec.root, {
    challengeId: spec.id,
    challengeVersion: spec.version,
    status,
    sourceSubmissionId: submission.id,
    score: scoreResult.score,
    metrics: scoreResult.metrics
  });
  const receipt = createReceipt({
    challengeId: spec.id,
    challengeVersion: spec.version,
    runId: run.id,
    score: run.score,
    metrics: run.metrics,
    verifier: verifierKind
  });
  await writeFile(join(getStoreDir(spec.root), `${run.id}.receipt.json`), JSON.stringify(receipt, null, 2), "utf8");

  const accepted = await updateSubmission(spec.root, submission.id, {
    status,
    [`${status}At`]: nowIso(),
    acceptedRunId: run.id,
    acceptedScore: run.score,
    acceptedMetrics: run.metrics
  });

  const result = {
    schemaVersion: "benchforge.verification.v1",
    createdAt: nowIso(),
    challenge: {
      id: spec.id,
      name: spec.name,
      version: spec.version,
      scoreDirection: spec.score.direction,
      primaryMetric: spec.score.primaryMetric
    },
    submission: {
      id: accepted.id,
      status: accepted.status,
      candidateScore: submission.score,
      candidateMetrics: submission.metrics,
      files: manifest.files
    },
    verifier: {
      kind: verifierKind,
      trusted
    },
    result: {
      status,
      runId: run.id,
      score: run.score,
      metrics: run.metrics,
      receiptHash: receipt.receiptHash
    },
    receipt
  };

  await writeFile(join(getStoreDir(spec.root), `${run.id}.verification.json`), JSON.stringify(result, null, 2), "utf8");
  return { submission: accepted, run, receipt, result };
}
