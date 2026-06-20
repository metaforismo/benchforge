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

export function validateChallengeSpec(spec, root = process.cwd()) {
  if (!spec || typeof spec !== "object") {
    throw new Error("challenge spec must be an object");
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
  requireString(spec.commands.test, "commands.test");
  requireString(spec.commands.score, "commands.score");
  if (spec.commands.verify !== undefined) {
    requireString(spec.commands.verify, "commands.verify");
  }

  return {
    ...spec,
    root: resolve(root),
    forbiddenPaths: spec.forbiddenPaths ?? [],
    hosted: spec.hosted ?? null
  };
}

export async function loadChallengeSpec(root = process.cwd()) {
  const specPath = join(root, "challenge.json");
  const raw = await readFile(specPath, "utf8");
  return validateChallengeSpec(JSON.parse(raw), root);
}
