#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadChallengeSpec } from "./spec.js";
import { runScore, runTest } from "./runner.js";
import { appendNote, appendRun, listNotes, listRuns } from "./store.js";
import { rankRuns } from "./leaderboard.js";
import { createReceipt, verifyReceipt } from "./receipts.js";
import { exportReport } from "./report.js";
import { createSubmission, verifySubmission } from "./submissions.js";
import { listSubmissions } from "./store.js";

function printHelp(cliName) {
  console.log(`Usage: ${cliName} <command>

Commands:
  run                       Run tests, score, store local run
  test                      Run public tests only
  score                     Run score command only
  submit                    Package current editable files as a candidate
  verify [id] [--json]      Verify candidate locally with public checks
                           optional: --output <path>
  receipt verify <file>     Verify a receipt JSON file
  submissions list          Show local candidate submissions
  leaderboard               Show local leaderboard
  notes add <text>          Add local note
  notes search <query>      Search local notes
  export-site               Export local static leaderboard
  help                      Show this help
`);
}

function getChallengeRoot() {
  return process.env.BENCHFORGE_CHALLENGE_ROOT || process.cwd();
}

function parseVerifyArgs(args) {
  const options = {
    id: "latest",
    json: false,
    output: null
  };
  let idWasSet = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--output") {
      const output = args[index + 1];
      if (!output) throw new Error("--output requires a path");
      options.output = output;
      index += 1;
    } else if (!idWasSet) {
      options.id = arg;
      idWasSet = true;
    } else {
      throw new Error(`unexpected verify argument: ${arg}`);
    }
  }

  return options;
}

async function writeJsonOutput(spec, outputPath, value) {
  const resolved = outputPath.startsWith("/") ? outputPath : resolve(spec.root, outputPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, JSON.stringify(value, null, 2), "utf8");
  return resolved;
}

async function main(argv = process.argv) {
  const spec = await loadChallengeSpec(getChallengeRoot());
  const cliName = spec.cli;
  const [command, subcommand, ...rest] = argv.slice(2);

  if (!command || command === "help") {
    printHelp(cliName);
    return;
  }

  if (command === "test") {
    const result = await runTest(spec);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
    return;
  }

  if (command === "score") {
    const score = await runScore(spec);
    console.log(JSON.stringify({ score: score.score, metrics: score.metrics }, null, 2));
    return;
  }

  if (command === "run") {
    const testResult = await runTest(spec);
    process.stdout.write(testResult.stdout);
    process.stderr.write(testResult.stderr);
    if (testResult.exitCode !== 0) {
      process.exitCode = testResult.exitCode;
      return;
    }

    const scoreResult = await runScore(spec);
    const run = await appendRun(spec.root, {
      challengeId: spec.id,
      challengeVersion: spec.version,
      status: "local",
      score: scoreResult.score,
      metrics: scoreResult.metrics
    });
    const receipt = createReceipt({
      challengeId: spec.id,
      challengeVersion: spec.version,
      runId: run.id,
      score: run.score,
      metrics: run.metrics,
      verifier: "local"
    });
    await writeFile(join(spec.root, ".benchforge", `${run.id}.receipt.json`), JSON.stringify(receipt, null, 2));
    console.log(`${cliName}: local run ${run.id}`);
    console.log(`${cliName}: score ${run.score}`);
    return;
  }

  if (command === "submit") {
    const testResult = await runTest(spec);
    process.stdout.write(testResult.stdout);
    process.stderr.write(testResult.stderr);
    if (testResult.exitCode !== 0) {
      process.exitCode = testResult.exitCode;
      return;
    }

    const scoreResult = await runScore(spec);
    const submission = await createSubmission(spec, scoreResult);
    console.log(`${cliName}: candidate submission ${submission.id}`);
    console.log(`${cliName}: score ${submission.score}`);
    console.log(`${cliName}: package ${submission.path}`);
    return;
  }

  if (command === "verify") {
    const options = parseVerifyArgs([subcommand, ...rest].filter(Boolean));
    const verified = await verifySubmission(spec, options.id);
    if (options.output) {
      const outputPath = await writeJsonOutput(spec, options.output, verified.result);
      if (!options.json) {
        console.log(`${cliName}: wrote verifier result ${outputPath}`);
      }
    }
    if (options.json) {
      console.log(JSON.stringify(verified.result, null, 2));
      return;
    }
    console.log(`${cliName}: accepted submission ${verified.submission.id}`);
    console.log(`${cliName}: accepted run ${verified.run.id}`);
    console.log(`${cliName}: score ${verified.run.score}`);
    return;
  }

  if (command === "receipt" && subcommand === "verify") {
    const receiptPath = rest[0];
    if (!receiptPath) throw new Error("receipt verify requires a file path");
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    if (!verifyReceipt(receipt)) {
      console.log(`${cliName}: receipt invalid`);
      process.exitCode = 1;
      return;
    }
    console.log(`${cliName}: receipt valid`);
    return;
  }

  if (command === "submissions" && subcommand === "list") {
    const submissions = await listSubmissions(spec.root);
    if (submissions.length === 0) {
      console.log(`${cliName}: no local submissions yet`);
      return;
    }
    for (const submission of submissions) {
      console.log(`${submission.id} ${submission.status} ${submission.score} ${submission.createdAt}`);
    }
    return;
  }

  if (command === "leaderboard") {
    const runs = rankRuns(spec, await listRuns(spec.root));
    if (runs.length === 0) {
      console.log(`${cliName}: no local runs yet`);
      return;
    }
    for (const [index, run] of runs.entries()) {
      console.log(`${index + 1}. ${run.score} ${run.status} ${run.id}`);
    }
    return;
  }

  if (command === "notes" && subcommand === "add") {
    const text = rest.join(" ").trim();
    if (!text) throw new Error("notes add requires text");
    const note = await appendNote(spec.root, { challengeId: spec.id, text });
    console.log(`${cliName}: added note ${note.id}`);
    return;
  }

  if (command === "notes" && subcommand === "search") {
    const query = rest.join(" ").trim();
    const notes = await listNotes(spec.root, query);
    for (const note of notes) {
      console.log(`${note.id} ${note.createdAt} ${note.text}`);
    }
    return;
  }

  if (command === "export-site") {
    const outputPath = await exportReport(spec, await listRuns(spec.root));
    console.log(`${cliName}: exported ${outputPath}`);
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
