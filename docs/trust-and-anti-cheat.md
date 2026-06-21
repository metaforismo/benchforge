# Trust And Anti-Cheat

Benchforge is built around one uncomfortable fact: local benchmark results are
easy to fake.

The system is useful because it separates:

- fast local iteration,
- portable candidate packaging,
- verifier replay,
- public promotion.

## Threat Model

Assume a solver or agent may accidentally or intentionally:

- edit the benchmark harness,
- edit config files,
- write a fake score file,
- keep stale score outputs,
- hardcode public examples,
- read hidden test files,
- use network access,
- depend on local cache state,
- submit files outside the intended surface,
- exploit nondeterminism or noisy timing,
- run an update command in the wrong repository.

The benchmark should still be able to reject or detect these cases.

## Trust Boundary

Public trust begins only when a trusted verifier replays the submitted artifact.

```text
solver machine
  local run
  candidate bundle
  local accepted replay

trusted verifier
  clean checkout
  imports bundle
  applies only editable files
  runs public tests
  runs verifier-only checks
  runs score
  emits trusted verifier result
```

The hosted API should store trusted metadata. It should not trust local scores.

## Submission Surface

Keep `editablePaths` narrow:

```json
{
  "editablePaths": ["starter/solution.js"]
}
```

Use wider globs only when the challenge genuinely needs them:

```json
{
  "editablePaths": ["src/solver/**"]
}
```

Add explicit forbidden paths:

```json
{
  "forbiddenPaths": ["harness/**", "challenge.json", "score.json"]
}
```

Benchforge bundles only editable files. A verifier applies those files to a
clean copy before replay.

## Public Tests

Public tests should be:

- fast,
- deterministic,
- readable,
- strong enough to catch accidental breakage,
- weak enough that hidden verifier checks still matter.

Public tests are not the full benchmark security boundary.

## Verifier-Only Checks

Use `commands.verify` for hidden or stronger checks:

```json
{
  "commands": {
    "test": "node harness/test.js",
    "verify": "node harness/verify.js",
    "score": "node harness/score.js"
  }
}
```

Verifier checks can include:

- hidden seeds,
- larger inputs,
- randomized but recorded cases,
- proof validation,
- resource-limit checks,
- artifact schema checks,
- forbidden behavior checks.

## Score Command Safety

The score command should:

- overwrite or delete stale score files before writing a new result,
- fail closed on invalid output,
- compute correctness-dependent metrics,
- include enough metrics for debugging,
- avoid importing untrusted code into trusted scoring when possible.

Expected score shape:

```json
{
  "score": 12.3,
  "metrics": {
    "time_ms": 12.3,
    "correctness_cases": 64
  }
}
```

## Timing Benchmarks

Timing benchmarks are noisy. When ranking by time:

- fix the runner environment when possible,
- warm up before measurement,
- use multiple repetitions,
- report median or trimmed mean,
- include hardware metadata,
- keep a public smoke benchmark separate from trusted final scoring.

For public leaderboards, a trusted runner should be the ranking source.

## ML Benchmarks

For ML challenges:

- separate public toy data from verifier data,
- fix compute budget,
- record seeds,
- validate output schema,
- check for data leakage,
- publish baseline scripts,
- keep private verifier data outside solver bundles,
- decide whether solvers submit code, weights, configs, or all three.

If weights are large, store references and hashes in the bundle, then fetch from
a controlled artifact store in the verifier.

## Math And Proof Benchmarks

For math challenges:

- prefer certificates, witnesses, or machine-checkable proofs,
- make the verifier deterministic,
- score proof size, construction cost, or objective value only after validity,
- keep invalid submissions out of the leaderboard,
- document exactly what theorem or property is checked.

The score should never reward an unchecked claim.

## Systems And Crypto Benchmarks

For systems and crypto challenges:

- isolate untrusted construction from trusted evaluation,
- disable network where possible,
- use throwaway directories,
- validate output formats strictly,
- record compiler/runtime versions,
- avoid giving solvers write access to harness or scorer code.

## Promotion Rules

Promotion should be strict:

```text
minimize:
  promote only if trusted score is lower than current public best.

maximize:
  promote only if trusted score is higher than current public best.

multi-objective:
  promote only if result is non-dominated under the declared Pareto rule.
```

Benchforge's hosted API currently implements a primary-score frontier. More
advanced Pareto promotion should be challenge-specific.

## Anti-Cheat Checklist

Before launch:

- Public tests pass.
- Verifier-only checks exist when needed.
- Score command overwrites stale score output.
- Editable paths are narrow.
- Forbidden paths include harness and config.
- Bundle hash covers submitted content.
- Verifier replays in a clean copy.
- Trusted runner is owner-controlled.
- Hosted API rejects untrusted verifier results.
- Update/sync commands require correct repo and clean worktree.
- Documentation says local results are not public proof.

