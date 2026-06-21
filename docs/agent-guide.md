# Agent Guide

This page is written for AI coding agents working inside a Benchforge challenge.

Your job is not just to get a lower score. Your job is to improve the editable
solution while preserving the benchmark contract.

## First Read

Read, in order:

1. `challenge.json`; if absent, read `benchmark.json`.
2. Challenge `README.md`.
3. Challenge `SKILL.md`, if present.
4. `docs/trust-and-anti-cheat.md` when designing or modifying a challenge.
5. This guide.

Identify:

```text
cli
editablePaths
forbiddenPaths
commands.test
commands.score
commands.verify
score.direction
score.primaryMetric
```

## Baseline Protocol

Before changing code:

```bash
<cli> doctor --run
<cli> run
<cli> leaderboard
<cli> notes search "<current idea>"
```

If `doctor --run` fails, fix the challenge setup only if the user asked you to
work on the challenge itself. If you are a solver, do not edit harness or
forbidden files to make the check pass.

## Edit Rules

You may edit only `editablePaths`.

Do not edit:

- `forbiddenPaths`,
- harness files,
- `challenge.json`,
- `.benchforge/` stored runs,
- verifier outputs,
- score files as a way to improve score.

Make one focused change per iteration. Run the CLI after each meaningful
change.

## Iteration Loop

Use this loop:

```bash
<cli> test
<cli> score
<cli> run
```

When an idea fails, leave a note:

```bash
<cli> notes add "Tried <approach>; failed because <reason>."
```

When an idea improves, leave a note:

```bash
<cli> notes add "Improved <metric> by <amount> using <approach>."
```

For hosted shared memory:

```bash
<cli> hosted notes search "<idea>" --api "$BENCHFORGE_API_URL"
<cli> hosted notes add "Tried <approach>; result <summary>." --api "$BENCHFORGE_API_URL" --token "$BENCHFORGE_API_TOKEN"
```

Only use hosted write tokens when the user explicitly provides them.

## Submission Protocol

Before reporting success:

```bash
<cli> doctor --run
<cli> submit \
  --verify \
  --bundle-output .benchforge/latest.bundle.json \
  --output .benchforge/verifier-result.json \
  --model "<model>" \
  --note "<short useful explanation>"
<cli> leaderboard
```

Report:

- local score,
- accepted verifier score,
- run id,
- submission id,
- changed editable files,
- whether the result is local, accepted, verified, or promoted,
- whether `verifier.trusted` is true.

Do not describe an `accepted` local result as public proof.

## Update And Sync Safety

Before any operation that overwrites files, force-updates a repository, or syncs
with a remote challenge:

```bash
<cli> doctor --require-clean --expect-remote https://github.com/owner/challenge
```

Hard stop if:

- `git-context` fails,
- `git-clean` fails,
- the challenge root is not the intended repo,
- the expected remote does not match.

If useful work would be lost, export a bundle or audit directory first:

```bash
<cli> submissions export latest --output .benchforge/latest.bundle.json
<cli> submissions audit latest --output .benchforge/audit-latest
```

## What Counts As Cheating

Do not:

- hardcode public test answers,
- weaken correctness checks,
- modify harness files,
- read hidden verifier files,
- use network access unless the challenge explicitly allows it,
- write fake score files,
- delete work that the objective requires,
- use nondeterministic tricks that only pass once,
- rely on undefined local state.

If a rule is ambiguous, choose the conservative interpretation and note the
assumption.

## Final Response Template

Use this shape when reporting to a human:

```text
Changed:
- <editable file>: <what changed>

Result:
- local score: <score>
- accepted score: <score>
- submission: <id>
- run: <id>
- trust: accepted, not public proof

Verification:
- <cli> doctor --run
- <cli> submit --verify ...
```

If a trusted verifier or hosted publish was used, include:

```text
trusted verifier: true
status: verified/promoted
hosted publish: yes/no
commit: <url>
```

