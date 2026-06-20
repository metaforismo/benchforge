import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

export function runChallengeCommand(root, command) {
  return new Promise((resolve, reject) => {
    const isArrayCommand = Array.isArray(command);
    const child = spawn(isArrayCommand ? command[0] : command, isArrayCommand ? command.slice(1) : [], {
      cwd: root,
      shell: !isArrayCommand,
      env: { ...process.env, BENCHFORGE_ROOT: root }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

export async function runTest(spec) {
  return runChallengeCommand(spec.root, spec.commands.test);
}

export async function runVerifierChecks(spec) {
  if (!spec.commands.verify) {
    return { exitCode: 0, stdout: "", stderr: "" };
  }
  return runChallengeCommand(spec.root, spec.commands.verify);
}

export async function runScore(spec) {
  const scorePath = join(spec.root, spec.scorePath ?? "score.json");
  await rm(scorePath, { force: true });
  const commandResult = await runChallengeCommand(spec.root, spec.commands.score);
  if (commandResult.exitCode !== 0) {
    throw new Error(`score command failed\n${commandResult.stderr || commandResult.stdout}`);
  }

  const rawScore = JSON.parse(await readFile(scorePath, "utf8"));
  if (typeof rawScore.score !== "number") {
    throw new Error("score.json must contain numeric score");
  }
  if (!rawScore.metrics || typeof rawScore.metrics !== "object") {
    throw new Error("score.json must contain metrics object");
  }

  return {
    score: rawScore.score,
    metrics: rawScore.metrics,
    stdout: commandResult.stdout,
    stderr: commandResult.stderr
  };
}
