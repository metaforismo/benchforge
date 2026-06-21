# Concepts

Benchforge separates a reusable benchmark engine from challenge-specific packs.

The engine knows how to:

- load a challenge contract,
- run public tests and scoring commands,
- package allowed files into a replayable submission bundle,
- replay a submission in a clean copy,
- record receipts and verifier results,
- export a local static leaderboard,
- publish trusted verifier results to an optional hosted API.

The challenge pack knows the domain:

- what solvers may edit,
- what they must not edit,
- what command checks correctness,
- what command computes the score,
- what hidden or verifier-only checks exist,
- what metric is minimized or maximized.

## Local-First

Benchforge assumes heavy benchmark work should run on the solver machine or on a
trusted verifier runner, not inside the website.

The hosted layer stores metadata:

- trusted verifier results,
- public leaderboard rows,
- notes,
- lightweight events.

It does not need to run expensive ML training, mathematical proof search,
cryptographic evaluation, or systems benchmarks online.

## Challenge Pack

A full challenge uses `challenge.json`:

```json
{
  "id": "toyfail",
  "name": "Toyfail",
  "cli": "toyfail",
  "version": "0.1.0",
  "score": {
    "direction": "minimize",
    "primaryMetric": "time_ms"
  },
  "editablePaths": ["starter/solution.js"],
  "forbiddenPaths": ["harness/**", "challenge.json"],
  "commands": {
    "test": "node harness/test.js",
    "score": "node harness/score.js",
    "verify": "node harness/verify.js"
  }
}
```

`commands.verify` is optional. Use it for checks that should only run in a
verifier environment, such as hidden seeds, private test cases, stronger
invariants, or expensive replay.

## Minimal Contract

Benchforge can also run a small `benchmark.json` contract when a full challenge
pack is unnecessary:

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

This is useful for ECDSA.fail-style repositories where the harness already
exists and the CLI only needs to run a benchmark command and read `score.json`.

## Trust Tiers

Benchforge uses strict trust language:

```text
local
  A run produced on the solver machine.

candidate
  A packaged submission that has not been replayed.

accepted
  A candidate replayed through local/public checks.

verified
  A candidate reproduced by one trusted verifier.

promoted
  A trusted result accepted onto the public frontier.

replicated
  A result reproduced by multiple trusted environments.
```

Never call `local` or `accepted` public proof.

## Neutral Artifact

The neutral artifact is a `benchforge.submission.v1` bundle. It contains:

- challenge id and version,
- candidate score and metrics,
- optional solver/model/note metadata,
- declared editable paths,
- submitted files,
- file hashes,
- a bundle hash over the content.

GitHub commits, hosted database rows, and static reports are indexes over that
artifact. They are useful for provenance, but the bundle is what gets replayed.

## Hybrid Public Model

Benchforge supports a hybrid model:

- local CLI for iteration and packaging,
- GitHub branches or commits for public audit,
- GitHub Actions for trusted replay,
- Cloudflare Worker + D1 for public leaderboard and notes,
- static report export for zero-hosting demos.

This keeps the solver flow short while preserving enough trust machinery for
public competitions.

