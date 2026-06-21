# Benchforge

Benchforge is a local-first factory for benchmark arenas.

It helps you build public challenges like ECDSA.fail-style arenas:

- a challenge-specific CLI
- local benchmark execution
- local notes for agents
- local leaderboard exports
- verifier receipts
- Cloudflare hosted leaderboards

## The Important Trust Rule

Local scores are useful for iteration, but they are not public proof.

For public leaderboards, Benchforge is designed around candidate submissions that are reproduced by an independent verifier and then marked as verified, promoted, or replicated.

Challenge authors can add an optional `commands.verify` entry in `challenge.json` for verifier-only checks such as hidden seeds, stronger invariants, or private validation scripts. Local `run` and `submit` use public checks; `verify` runs both public checks and verifier-only checks before scoring.

## Quick Start

```bash
npm test
npm run toyfail:doctor
npm run toyfail:run
npm run toyfail:submit
npm run toyfail:submit:verify
npm run toyfail:verify:json
npm run toyfail:verify:trusted
npm run toyfail:submissions
npm run toyfail:leaderboard
npm run toyfail:report
npm run hosted:test
```

Open the exported report:

```text
challenges/toyfail/.benchforge/site/index.html
```

## Create A New Challenge

```bash
node ./packages/core/src/cli.js create grpoarena --name "GRPO Arena"
node ./challenges/grpoarena/bin/grpoarena.js doctor --run
node ./challenges/grpoarena/bin/grpoarena.js run
node ./challenges/grpoarena/bin/grpoarena.js submit --verify --bundle-output .benchforge/latest.bundle.json
node ./challenges/grpoarena/bin/grpoarena.js verify --json --output .benchforge/verifier-result.json
```

That generated CLI is real: it loads the shared Benchforge engine with the generated `challenges/grpoarena/challenge.json`.

Before any agent-driven update or sync, run:

```bash
node ./challenges/grpoarena/bin/grpoarena.js doctor \
  --require-clean \
  --expect-remote https://github.com/you/grpoarena
```

This is the guardrail against the classic "agent ran a force update in the
wrong directory" failure. A future sync/update command should refuse to proceed
unless this check passes.

## Minimal Benchmark Contract

Benchforge can also run an ECDSA.fail-style `benchmark.json` when no
`challenge.json` is present:

```json
{
  "schemaVersion": 1,
  "name": "my-benchmark",
  "direction": "-",
  "editablePaths": ["src/solution"],
  "setupCommand": ["bash", "-lc", "./setup.sh"],
  "benchmarkCommand": ["bash", "-lc", "./benchmark.sh"],
  "scorePath": "score.json"
}
```

`benchmarkCommand` must write the configured score file with this shape:

```json
{ "score": 12.3, "metrics": { "time_ms": 12.3 } }
```

The full `challenge.json` format is still better when you want separate public
tests, verifier-only checks, hosted settings, or a custom branded CLI.

## Skills

The repository includes two Codex skills:

- `skills/benchmark-designer`: use before creating a challenge. It asks the benchmark-design questions around artifact shape, score, hidden checks, verifier environment, and cheat risks.
- `skills/benchforge`: use inside an existing Benchforge challenge. It guides agents through baseline runs, allowed edits, notes, submit, verify, and precise trust language.

Generated challenges also include a challenge-specific `SKILL.md`, such as `challenges/toyfail/SKILL.md`.

Validate the skills with:

```bash
npm run skills:validate
```

## Branded CLIs

Each challenge can have its own CLI:

```bash
toyfail run
rckfail run
grpoarena run
```

Those commands are real executables. They load the shared Benchforge engine with a specific challenge pack, so the benchmark behavior comes from that pack's spec and harness.

## Current Status

This repository starts with a local-first MVP:

- shared core engine
- `toyfail` demo challenge
- challenge generator with branded CLI wrappers
- `doctor --run` preflight for challenge, verifier, bundle, and git-context checks
- local notes
- local candidate submissions
- local public-check verification
- local leaderboard
- local static report
- GitHub Actions test baseline

The repository now includes an optional Cloudflare Worker + D1 hosted layer for public leaderboards.

## Local Submission Loop

```bash
npm run toyfail:doctor
npm run toyfail:run
npm run toyfail:submit:verify
npm run toyfail:verify:json
npm run toyfail:leaderboard
```

`submit` packages only the editable files declared by `challenge.json`.

For an ECDSA.fail-style local loop, use one command:

```bash
node ./challenges/toyfail/bin/toyfail.js submit \
  --verify \
  --bundle-output .benchforge/latest.bundle.json \
  --output .benchforge/verifier-result.json \
  --solver "Ada" \
  --model "Claude Test" \
  --note "Describe the approach in one or two useful sentences."
```

Each submission also writes a portable `benchforge.submission.v1` bundle containing only allowed editable files, file hashes, and candidate metadata. You can export or verify a bundle directly:

```bash
node ./challenges/toyfail/bin/toyfail.js submit --bundle-output .benchforge/latest.bundle.json
node ./challenges/toyfail/bin/toyfail.js verify --bundle .benchforge/latest.bundle.json --json --output .benchforge/verifier-result.json
node ./challenges/toyfail/bin/toyfail.js submissions export latest --output .benchforge/latest.bundle.json
node ./challenges/toyfail/bin/toyfail.js submissions import .benchforge/latest.bundle.json
node ./challenges/toyfail/bin/toyfail.js submissions audit latest --output .benchforge/audit-latest
```

`verify` reconstructs the candidate in a temporary clean challenge copy, runs public tests and scoring, and records an `accepted` local run.

Submission metadata is optional and travels with the bundle/verifier result:
`solver`, `model`, `modelFamily`, `note`, and `commitUrl`. The static report
uses those fields to show ECDSA.fail-style details without making GitHub the
only backend.

`submissions audit` writes a GitHub-friendly directory containing the portable
bundle, editable files, local metadata, README, and verifier result when one is
available. This is useful for a `submissions/<id>` branch or for attaching a
complete artifact to another review system.

`verify --json --output .benchforge/verifier-result.json` emits a stable machine-readable verifier result:

```json
{
  "schemaVersion": "benchforge.verification.v1",
  "verifier": { "kind": "local-public", "trusted": false },
  "result": { "status": "accepted", "score": 12.3 }
}
```

This is still local verification, not public trust. A future trusted runner can reuse the same package shape and mark results as `verified`, `promoted`, or `replicated`.

CI can mark a result as trusted/promoted:

```bash
npm run toyfail:verify:trusted
```

This uses:

```bash
toyfail verify --json --trusted --promote --verifier-kind github-actions --output .benchforge/verifier-result.json
```

`npm run toyfail:report` writes both:

```text
challenges/toyfail/.benchforge/site/index.html
challenges/toyfail/.benchforge/site/leaderboard.json
```

## Hosted Leaderboard

The hosted layer lives in `packages/hosted`.

It stores only metadata:

- trusted verifier results
- leaderboard rows
- public notes
- lightweight CLI events

When a trusted result asks to be `promoted`, the hosted API only keeps that status if the score improves the current public frontier. Non-improving promoted requests are stored as `verified`.

It does not run heavy benchmarks online. A trusted runner, such as GitHub Actions, runs:

```bash
npm run toyfail:verify:trusted
```

Then publishes:

```bash
node ./challenges/toyfail/bin/toyfail.js publish-verification \
  --api "$BENCHFORGE_API_URL" \
  --token "$BENCHFORGE_API_TOKEN"
```

Read the hosted leaderboard:

```bash
node ./challenges/toyfail/bin/toyfail.js hosted leaderboard \
  --api "$BENCHFORGE_API_URL"
```

Cloudflare setup is documented in `docs/hosted-cloudflare.md`.

GitHub Actions verifier setup is documented in `docs/github-actions-verifier.md`.

Design notes from the public ECDSA.fail challenge repo are in `docs/ecdsafail-patterns.md`.
