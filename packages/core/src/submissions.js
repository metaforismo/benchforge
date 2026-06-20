import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { runScore, runTest, runVerifierChecks } from "./runner.js";
import { appendRun, appendSubmission, getStoreDir, listSubmissions, updateSubmission } from "./store.js";
import { createReceipt } from "./receipts.js";

function nowIso() {
  return new Date().toISOString();
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
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

async function createSubmissionBundle(spec, manifest) {
  const files = [];
  for (const file of manifest.files) {
    const bytes = await readFile(join(spec.root, file));
    files.push({
      path: file,
      size: bytes.byteLength,
      sha256: sha256(bytes),
      contentBase64: bytes.toString("base64")
    });
  }

  const unsigned = {
    schemaVersion: "benchforge.submission.v1",
    createdAt: nowIso(),
    challenge: {
      id: spec.id,
      name: spec.name,
      version: spec.version,
      scoreDirection: spec.score.direction,
      primaryMetric: spec.score.primaryMetric
    },
    submission: {
      id: manifest.id,
      createdAt: manifest.createdAt,
      status: "candidate",
      candidateScore: manifest.score,
      candidateMetrics: manifest.metrics,
      editablePaths: manifest.editablePaths,
      files: manifest.files
    },
    files
  };

  return {
    ...unsigned,
    bundleHash: sha256(Buffer.from(canonicalJson(unsigned)))
  };
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
  const bundle = await createSubmissionBundle(spec, manifest);
  const bundlePath = join(submissionDir, "submission.bundle.json");
  await writeFile(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  return appendSubmission(spec.root, {
    ...manifest,
    id: submissionId,
    path: submissionDir,
    bundlePath,
    bundleHash: bundle.bundleHash
  });
}

async function latestSubmission(root) {
  const submissions = await listSubmissions(root);
  return submissions.at(-1) ?? null;
}

async function findSubmission(root, requestedId = "latest") {
  if (requestedId === "latest") return latestSubmission(root);
  return (await listSubmissions(root)).find((candidate) => candidate.id === requestedId);
}

export async function exportSubmissionBundle(spec, requestedId = "latest", outputPath = null) {
  const submission = await findSubmission(spec.root, requestedId);
  if (!submission) {
    throw new Error("no submission found");
  }
  const bundlePath = submission.bundlePath ?? join(submission.path, "submission.bundle.json");
  const resolvedOutput = outputPath ?? join(getStoreDir(spec.root), `${submission.id}.submission.bundle.json`);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await copyFile(bundlePath, resolvedOutput);
  return {
    submission,
    outputPath: resolvedOutput
  };
}

function auditReadme(spec, submission) {
  const lines = [
    `# Benchforge Submission ${submission.id}`,
    "",
    `Challenge: ${spec.name} (${spec.id})`,
    `Version: ${spec.version}`,
    `Status: ${submission.status}`,
    `Candidate score: ${submission.score}`,
    `Bundle hash: ${submission.bundleHash ?? "unknown"}`,
    "",
    "## Contents",
    "",
    "- `submission.bundle.json`: portable benchforge.submission.v1 bundle",
    "- `submission.json`: local candidate metadata",
    "- `files/`: editable files exactly as submitted",
    "- `verifier-result.json`: verifier result, when this submission has been verified",
    "",
    "## Replay",
    "",
    "```bash",
    `${spec.cli} submissions import submission.bundle.json`,
    `${spec.cli} verify --bundle submission.bundle.json --json --output .benchforge/verifier-result.json`,
    "```",
    "",
    "Local or accepted status is not public proof. Public trust requires a trusted verifier."
  ];
  return `${lines.join("\n")}\n`;
}

export async function exportSubmissionAudit(spec, requestedId = "latest", outputDir = null) {
  const submission = await findSubmission(spec.root, requestedId);
  if (!submission) {
    throw new Error("no submission found");
  }

  const resolvedOutput = outputDir ?? join(getStoreDir(spec.root), "audit", submission.id);
  await mkdir(resolvedOutput, { recursive: true });
  await mkdir(join(resolvedOutput, "files"), { recursive: true });

  const bundlePath = submission.bundlePath ?? join(submission.path, "submission.bundle.json");
  await copyFile(bundlePath, join(resolvedOutput, "submission.bundle.json"));
  await copyFile(join(submission.path, "submission.json"), join(resolvedOutput, "submission.json"));
  await cp(join(submission.path, "files"), join(resolvedOutput, "files"), { recursive: true });

  if (submission.acceptedRunId) {
    const verifierResultPath = join(getStoreDir(spec.root), `${submission.acceptedRunId}.verification.json`);
    try {
      await copyFile(verifierResultPath, join(resolvedOutput, "verifier-result.json"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  await writeFile(join(resolvedOutput, "README.md"), auditReadme(spec, submission), "utf8");
  return {
    submission,
    outputDir: resolvedOutput
  };
}

function assertBundleMatchesSpec(spec, bundle) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("submission bundle must be an object");
  }
  if (bundle.schemaVersion !== "benchforge.submission.v1") {
    throw new Error("submission bundle schemaVersion must be benchforge.submission.v1");
  }
  if (bundle.challenge?.id !== spec.id) {
    throw new Error(`submission bundle challenge ${bundle.challenge?.id ?? "unknown"} does not match ${spec.id}`);
  }
  if (bundle.challenge?.version !== spec.version) {
    throw new Error(`submission bundle version ${bundle.challenge?.version ?? "unknown"} does not match ${spec.version}`);
  }
  if (!bundle.submission || typeof bundle.submission !== "object") {
    throw new Error("submission bundle missing submission metadata");
  }
  if (typeof bundle.submission.id !== "string" || bundle.submission.id.length === 0) {
    throw new Error("submission bundle missing submission id");
  }
  if (!Array.isArray(bundle.submission.files) || bundle.submission.files.length === 0) {
    throw new Error("submission bundle must declare files");
  }
  if (!Array.isArray(bundle.files) || bundle.files.length === 0) {
    throw new Error("submission bundle must include files");
  }

  const { bundleHash, ...unsigned } = bundle;
  if (bundleHash !== sha256(Buffer.from(canonicalJson(unsigned)))) {
    throw new Error("submission bundle hash mismatch");
  }

  const expectedFiles = new Set(bundle.submission.files ?? []);
  const seenFiles = new Set();
  for (const entry of bundle.files) {
    const file = assertSafeRelativePath(entry.path);
    if (!expectedFiles.has(file)) {
      throw new Error(`submission bundle contains undeclared file: ${file}`);
    }
    if (seenFiles.has(file)) {
      throw new Error(`submission bundle contains duplicate file: ${file}`);
    }
    seenFiles.add(file);
    if (!isPathAllowed(file, spec.editablePaths)) {
      throw new Error(`submission bundle contains forbidden path: ${file}`);
    }
    const bytes = Buffer.from(String(entry.contentBase64 ?? ""), "base64");
    if (entry.sha256 !== sha256(bytes)) {
      throw new Error(`submission bundle hash mismatch: ${file}`);
    }
    if (entry.size !== bytes.byteLength) {
      throw new Error(`submission bundle size mismatch: ${file}`);
    }
  }
  for (const file of expectedFiles) {
    if (!seenFiles.has(file)) {
      throw new Error(`submission bundle missing file: ${file}`);
    }
  }
}

export async function importSubmissionBundle(spec, bundlePath) {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  assertBundleMatchesSpec(spec, bundle);

  const existing = (await listSubmissions(spec.root)).find((submission) => submission.id === bundle.submission.id);
  if (existing) {
    return { submission: existing, alreadyImported: true };
  }

  const submissionDir = join(getStoreDir(spec.root), "submissions", bundle.submission.id);
  await mkdir(join(submissionDir, "files"), { recursive: true });

  for (const entry of bundle.files) {
    const file = assertSafeRelativePath(entry.path);
    const destination = join(submissionDir, "files", file);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, Buffer.from(entry.contentBase64, "base64"));
  }

  const manifest = {
    id: bundle.submission.id,
    createdAt: bundle.submission.createdAt ?? nowIso(),
    challengeId: spec.id,
    challengeVersion: spec.version,
    status: "candidate",
    score: bundle.submission.candidateScore ?? null,
    metrics: bundle.submission.candidateMetrics ?? {},
    editablePaths: bundle.submission.editablePaths ?? spec.editablePaths,
    files: bundle.submission.files
  };
  const localBundlePath = join(submissionDir, "submission.bundle.json");
  await writeFile(join(submissionDir, "submission.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(localBundlePath, JSON.stringify(bundle, null, 2), "utf8");

  const submission = await appendSubmission(spec.root, {
    ...manifest,
    path: submissionDir,
    bundlePath: localBundlePath,
    bundleHash: bundle.bundleHash,
    importedFrom: bundlePath
  });
  return { submission, alreadyImported: false };
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
  const submission = await findSubmission(spec.root, requestedId);

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

export async function verifySubmissionBundle(spec, bundlePath, options = {}) {
  const imported = await importSubmissionBundle(spec, bundlePath);
  const verified = await verifySubmission(spec, imported.submission.id, options);
  return {
    ...verified,
    imported
  };
}
