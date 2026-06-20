import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array`);
  }
}

function requireCommand(value, name) {
  if (typeof value === "string" && value.length > 0) {
    return;
  }
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0)) {
    return;
  }
  throw new Error(`${name} must be a non-empty string or string array`);
}

function idFromName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "benchmark";
}

function normalizeDirection(direction) {
  if (direction === "-" || direction === "minimize") return "minimize";
  if (direction === "+" || direction === "maximize") return "maximize";
  throw new Error("score.direction must be minimize/maximize or +/-");
}

function normalizeBenchmarkSpec(spec) {
  requireString(spec.name, "name");
  requireArray(spec.editablePaths, "editablePaths");
  requireCommand(spec.benchmarkCommand, "benchmarkCommand");

  const id = spec.id ?? idFromName(spec.name);
  const direction = normalizeDirection(spec.direction ?? "-");
  const scorePath = spec.scorePath ?? "score.json";
  const primaryMetric = spec.primaryMetric ?? "score";

  return {
    id,
    name: spec.name,
    cli: spec.cli ?? id,
    version: String(spec.version ?? spec.schemaVersion ?? "1"),
    description: spec.description ?? "",
    category: spec.category ?? null,
    score: {
      direction,
      primaryMetric,
      secondaryMetrics: spec.secondaryMetrics ?? []
    },
    editablePaths: spec.editablePaths,
    forbiddenPaths: spec.forbiddenPaths ?? [],
    commands: {
      setup: spec.setupCommand,
      test: spec.testCommand ?? spec.benchmarkCommand,
      verify: spec.verifyCommand,
      score: spec.benchmarkCommand
    },
    scorePath,
    source: spec.source ?? null,
    hosted: spec.hosted ?? null
  };
}

export function validateChallengeSpec(spec, root = process.cwd()) {
  if (!spec || typeof spec !== "object") {
    throw new Error("challenge spec must be an object");
  }

  if (spec.benchmarkCommand && !spec.commands) {
    return validateChallengeSpec(normalizeBenchmarkSpec(spec), root);
  }

  requireString(spec.id, "id");
  requireString(spec.name, "name");
  requireString(spec.cli, "cli");
  requireString(spec.version, "version");

  if (!spec.score || typeof spec.score !== "object") {
    throw new Error("score is required");
  }
  if (!["minimize", "maximize"].includes(spec.score.direction)) {
    throw new Error("score.direction must be minimize or maximize");
  }
  requireString(spec.score.primaryMetric, "score.primaryMetric");
  requireArray(spec.editablePaths, "editablePaths");

  if (!spec.commands || typeof spec.commands !== "object") {
    throw new Error("commands is required");
  }
  requireCommand(spec.commands.test, "commands.test");
  requireCommand(spec.commands.score, "commands.score");
  if (spec.commands.verify !== undefined) {
    requireCommand(spec.commands.verify, "commands.verify");
  }
  if (spec.commands.setup !== undefined) {
    requireCommand(spec.commands.setup, "commands.setup");
  }

  return {
    ...spec,
    root: resolve(root),
    forbiddenPaths: spec.forbiddenPaths ?? [],
    hosted: spec.hosted ?? null,
    scorePath: spec.scorePath ?? "score.json"
  };
}

export async function loadChallengeSpec(root = process.cwd()) {
  try {
    const raw = await readFile(join(root, "challenge.json"), "utf8");
    return {
      ...validateChallengeSpec(JSON.parse(raw), root),
      configFile: "challenge.json",
      configFormat: "challenge"
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const raw = await readFile(join(root, "benchmark.json"), "utf8");
  return {
    ...validateChallengeSpec(JSON.parse(raw), root),
    configFile: "benchmark.json",
    configFormat: "benchmark"
  };
}
