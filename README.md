# Benchforge

Benchforge is a local-first factory for benchmark arenas.

It helps you build public challenges like ECDSA.fail-style arenas:

- a challenge-specific CLI
- local benchmark execution
- local notes for agents
- local leaderboard exports
- verifier receipts
- a path to hosted leaderboards

## The Important Trust Rule

Local scores are useful for iteration, but they are not public proof.

For public leaderboards, Benchforge is designed around candidate submissions that are reproduced by an independent verifier and then marked as verified, promoted, or replicated.

## Quick Start

```bash
npm test
npm run toyfail:run
npm run toyfail:submit
npm run toyfail:verify:json
npm run toyfail:submissions
npm run toyfail:leaderboard
npm run toyfail:report
```

Open the exported report:

```text
challenges/toyfail/.benchforge/site/index.html
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
- local notes
- local candidate submissions
- local public-check verification
- local leaderboard
- local static report
- GitHub Actions test baseline

Cloudflare hosted leaderboards and external verifier runners are the next layer.

## Local Submission Loop

```bash
npm run toyfail:run
npm run toyfail:submit
npm run toyfail:verify:json
npm run toyfail:leaderboard
```

`submit` packages only the editable files declared by `challenge.json`.

`verify` reconstructs the candidate in a temporary clean challenge copy, runs public tests and scoring, and records an `accepted` local run.

`verify --json --output .benchforge/verifier-result.json` emits a stable machine-readable verifier result:

```json
{
  "schemaVersion": "benchforge.verification.v1",
  "verifier": { "kind": "local-public", "trusted": false },
  "result": { "status": "accepted", "score": 12.3 }
}
```

This is still local verification, not public trust. A future trusted runner can reuse the same package shape and mark results as `verified`, `promoted`, or `replicated`.
