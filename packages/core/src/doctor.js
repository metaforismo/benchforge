import { listEditableFiles } from "./submissions.js";
import { runScore, runTest, runVerifierChecks } from "./runner.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function check(name, status, message, details = null) {
  return {
    name,
    status,
    message,
    ...(details === null ? {} : { details })
  };
}

function reportStatus(checks) {
  if (checks.some((item) => item.status === "fail")) return "fail";
  if (checks.some((item) => item.status === "warn")) return "warn";
  return "pass";
}

function hasHostedApi(spec) {
  return typeof spec.hosted?.apiUrl === "string" && spec.hosted.apiUrl.length > 0;
}

function normalizeRemote(remote) {
  return String(remote ?? "")
    .trim()
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^ssh:\/\/git@([^/]+)\//, "https://$1/")
    .replace(/\.git$/, "")
    .replace(/^https?:\/\//, "")
    .toLowerCase();
}

function expectedRepository(spec) {
  if (typeof spec.source?.repository === "string") return spec.source.repository;
  if (typeof spec.repository?.url === "string") return spec.repository.url;
  if (typeof spec.repository === "string") return spec.repository;
  return null;
}

async function gitContext(root) {
  try {
    const rootResult = await execFileAsync("git", ["-C", root, "rev-parse", "--show-toplevel"]);
    let remote = "";
    try {
      const remoteResult = await execFileAsync("git", ["-C", root, "config", "--get", "remote.origin.url"]);
      remote = remoteResult.stdout.trim();
    } catch {
      remote = "";
    }
    return {
      root: rootResult.stdout.trim(),
      remote
    };
  } catch {
    return null;
  }
}

export async function runDoctor(spec, options = {}) {
  const checks = [];

  checks.push(check("spec", "pass", `${spec.configFile ?? "challenge.json"} loaded`, {
    id: spec.id,
    version: spec.version,
    cli: spec.cli
  }));

  try {
    const editableFiles = await listEditableFiles(spec.root, spec.editablePaths);
    checks.push(check("editable-files", "pass", `${editableFiles.length} editable file(s) found`, {
      editablePaths: spec.editablePaths,
      files: editableFiles
    }));
  } catch (error) {
    checks.push(check("editable-files", "fail", error.message));
  }

  checks.push(spec.forbiddenPaths.length > 0
    ? check("forbidden-paths", "pass", `${spec.forbiddenPaths.length} forbidden path pattern(s) configured`, {
      forbiddenPaths: spec.forbiddenPaths
    })
    : check("forbidden-paths", "warn", "no forbiddenPaths configured"));

  checks.push(spec.commands.verify
    ? check("verifier-checks", "pass", "commands.verify is configured", { command: spec.commands.verify })
    : check("verifier-checks", "warn", "commands.verify is not configured; public tests and verifier checks are identical"));

  checks.push(spec.commands.setup
    ? check("setup-command", "pass", "commands.setup is configured", { command: spec.commands.setup })
    : check("setup-command", "pass", "no setup command configured"));

  checks.push(check("score-path", "pass", `score output path is ${spec.scorePath ?? "score.json"}`));

  checks.push(hasHostedApi(spec)
    ? check("hosted-api", "pass", "hosted API URL configured", { apiUrl: spec.hosted.apiUrl })
    : check("hosted-api", "warn", "hosted API URL not configured; local and artifact workflows still work"));

  checks.push(check("submission-bundles", "pass", "portable benchforge.submission.v1 bundles are supported"));

  checks.push(check("challenge-root", "pass", "challenge root resolved", { root: spec.root }));

  const expectedRemote = expectedRepository(spec);
  const git = await gitContext(spec.root);
  if (!git && expectedRemote) {
    checks.push(check("git-context", "fail", "expected repository is configured but challenge root is not inside a git repo", {
      expectedRemote
    }));
  } else if (!git) {
    checks.push(check("git-context", "pass", "no git repository detected; no expected remote configured"));
  } else if (expectedRemote && normalizeRemote(git.remote) !== normalizeRemote(expectedRemote)) {
    checks.push(check("git-context", "fail", "git remote does not match expected challenge repository", {
      gitRoot: git.root,
      remote: git.remote,
      expectedRemote
    }));
  } else {
    checks.push(check("git-context", "pass", "git repository context detected", {
      gitRoot: git.root,
      remote: git.remote || null,
      expectedRemote
    }));
  }

  if (options.run === true) {
    const testResult = await runTest(spec);
    checks.push(testResult.exitCode === 0
      ? check("public-tests", "pass", "public test command passed")
      : check("public-tests", "fail", "public test command failed", {
        exitCode: testResult.exitCode,
        stdout: testResult.stdout,
        stderr: testResult.stderr
      }));

    if (spec.commands.verify) {
      const verifierResult = await runVerifierChecks(spec);
      checks.push(verifierResult.exitCode === 0
        ? check("verifier-command", "pass", "verifier-only command passed")
        : check("verifier-command", "fail", "verifier-only command failed", {
          exitCode: verifierResult.exitCode,
          stdout: verifierResult.stdout,
          stderr: verifierResult.stderr
        }));
    }

    try {
      const score = await runScore(spec);
      checks.push(check("score", "pass", "score command produced numeric score and metrics", {
        score: score.score,
        metrics: score.metrics
      }));
    } catch (error) {
      checks.push(check("score", "fail", error.message));
    }
  }

  return {
    schemaVersion: "benchforge.doctor.v1",
    generatedAt: new Date().toISOString(),
    challenge: {
      id: spec.id,
      name: spec.name,
      version: spec.version,
      cli: spec.cli
    },
    status: reportStatus(checks),
    checks
  };
}
