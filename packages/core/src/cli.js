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
import { createChallenge } from "./create.js";
import {
  addHostedNote,
  fetchHostedLeaderboard,
  hostedConfigFromEnv,
  publishVerifierResult,
  searchHostedNotes
} from "./hosted.js";

function printChallengeHelp(cliName) {
  console.log(`Usage: ${cliName} <command>

Commands:
  run                       Run tests, score, store local run
  test                      Run public tests only
  score                     Run score command only
  submit                    Package current editable files as a candidate
  verify [id] [--json]      Verify candidate with public checks
                           optional: --output <path>
                           optional: --trusted --promote --verifier-kind <kind>
  receipt verify <file>     Verify a receipt JSON file
  submissions list          Show local candidate submissions
  leaderboard               Show local leaderboard
  notes add <text>          Add local note
  notes search <query>      Search local notes
  publish-verification      Publish verifier-result JSON to hosted API
                           optional: --file <path> --api <url> --token <token>
  hosted leaderboard        Fetch hosted leaderboard
                           optional: --api <url> --json
  hosted notes add <text>   Add hosted note
                           optional: --api <url> --token <token> --title <title>
  hosted notes search <q>   Search hosted notes
                           optional: --api <url> --limit <n>
  export-site               Export local static leaderboard
  help                      Show this help
`);
}

function printFactoryHelp() {
  console.log(`Usage: benchforge <command>

Commands:
  create <id>               Create a new branded challenge pack
                            optional: --name <name> --cli <cli> --root <path> --force
  help                      Show this help
`);
}

function getChallengeRoot() {
  return process.env.BENCHFORGE_CHALLENGE_ROOT || process.cwd();
}

function parseCreateArgs(args) {
  const id = args[0];
  if (!id || id.startsWith("--")) {
    throw new Error("create requires a challenge id");
  }

  const options = {
    id,
    name: null,
    cli: null,
    root: process.cwd(),
    force: false
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--name") {
      const name = args[index + 1];
      if (!name) throw new Error("--name requires a value");
      options.name = name;
      index += 1;
    } else if (arg === "--cli") {
      const cli = args[index + 1];
      if (!cli) throw new Error("--cli requires a value");
      options.cli = cli;
      index += 1;
    } else if (arg === "--root") {
      const root = args[index + 1];
      if (!root) throw new Error("--root requires a value");
      options.root = resolve(root);
      index += 1;
    } else if (arg === "--force") {
      options.force = true;
    } else {
      throw new Error(`unexpected create argument: ${arg}`);
    }
  }

  return options;
}

function parseVerifyArgs(args) {
  const options = {
    id: "latest",
    json: false,
    output: null,
    trusted: false,
    promote: false,
    verifierKind: null
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
    } else if (arg === "--trusted") {
      options.trusted = true;
    } else if (arg === "--promote") {
      options.promote = true;
    } else if (arg === "--verifier-kind") {
      const verifierKind = args[index + 1];
      if (!verifierKind) throw new Error("--verifier-kind requires a value");
      options.verifierKind = verifierKind;
      index += 1;
    } else if (!idWasSet) {
      options.id = arg;
      idWasSet = true;
    } else {
      throw new Error(`unexpected verify argument: ${arg}`);
    }
  }

  if (options.promote && !options.trusted) {
    throw new Error("--promote requires --trusted");
  }

  return options;
}

function parseOptions(args) {
  const positional = [];
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    if (key === "json") {
      options.json = true;
      continue;
    }

    const value = args[index + 1];
    if (!value) throw new Error(`${arg} requires a value`);
    options[key] = value;
    index += 1;
  }

  return { positional, options };
}

function hostedOptions(spec, options) {
  const env = hostedConfigFromEnv();
  return {
    apiUrl: options.api ?? spec.hosted?.apiUrl ?? env.apiUrl,
    token: options.token ?? env.token,
    challengeId: options.challenge ?? spec.id
  };
}

async function writeJsonOutput(spec, outputPath, value) {
  const resolved = outputPath.startsWith("/") ? outputPath : resolve(spec.root, outputPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, JSON.stringify(value, null, 2), "utf8");
  return resolved;
}

async function main(argv = process.argv) {
  const [command, subcommand, ...rest] = argv.slice(2);

  if (command === "create") {
    const created = await createChallenge(parseCreateArgs([subcommand, ...rest].filter(Boolean)));
    console.log(`benchforge: created ${created.name} at ${created.root}`);
    console.log(`benchforge: run with ${created.command}`);
    return;
  }

  let spec;
  try {
    spec = await loadChallengeSpec(getChallengeRoot());
  } catch (error) {
    if (error.code === "ENOENT" && (!command || command === "help")) {
      printFactoryHelp();
      return;
    }
    throw error;
  }
  const cliName = spec.cli;

  if (!command || command === "help") {
    printChallengeHelp(cliName);
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
    const verified = await verifySubmission(spec, options.id, {
      trusted: options.trusted,
      promote: options.promote,
      verifierKind: options.verifierKind
    });
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

  if (command === "publish-verification") {
    const { options } = parseOptions([subcommand, ...rest].filter(Boolean));
    const published = await publishVerifierResult({
      ...hostedOptions(spec, options),
      file: options.file ?? join(spec.root, ".benchforge", "verifier-result.json")
    });
    console.log(`${cliName}: published ${published.status} run ${published.runId}`);
    console.log(`${cliName}: hosted score ${published.score}`);
    return;
  }

  if (command === "hosted" && subcommand === "leaderboard") {
    const { options } = parseOptions(rest);
    const leaderboard = await fetchHostedLeaderboard(hostedOptions(spec, options));
    if (options.json) {
      console.log(JSON.stringify(leaderboard, null, 2));
      return;
    }
    if (!leaderboard.entries.length) {
      console.log(`${cliName}: hosted leaderboard is empty`);
      return;
    }
    for (const entry of leaderboard.entries) {
      console.log(`${entry.rank}. ${entry.score} ${entry.status} ${entry.runId}`);
    }
    return;
  }

  if (command === "hosted" && subcommand === "notes") {
    const [action, ...noteArgs] = rest;
    const { positional, options } = parseOptions(noteArgs);
    if (action === "add") {
      const body = positional.join(" ").trim();
      const note = await addHostedNote({
        ...hostedOptions(spec, options),
        body,
        title: options.title,
        author: options.author
      });
      console.log(`${cliName}: added hosted note ${note.id}`);
      return;
    }
    if (action === "search") {
      const query = positional.join(" ").trim();
      const result = await searchHostedNotes({
        ...hostedOptions(spec, options),
        query,
        limit: options.limit
      });
      for (const note of result.notes) {
        console.log(`${note.id} ${note.createdAt} ${note.title}: ${note.body}`);
      }
      return;
    }
  }

  if (command === "export-site") {
    const outputPath = await exportReport(spec, await listRuns(spec.root), await listSubmissions(spec.root));
    console.log(`${cliName}: exported ${outputPath}`);
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
