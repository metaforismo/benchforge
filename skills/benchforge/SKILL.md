---
name: benchforge
description: Work inside Benchforge benchmark challenges and branded CLIs. Use when optimizing a challenge, running local benchmarks, packaging candidate submissions, verifying verifier-result JSON, reading or writing challenge notes, respecting editable/forbidden paths, or helping an agent iterate on a Benchforge-generated arena such as toyfail, rckfail, grpoarena, or similar CLI/leaderboard benchmarks.
---

# Benchforge

Use this skill when working inside a Benchforge challenge.

## First Pass

1. Read `challenge.json`.
2. Identify `cli`, `editablePaths`, `forbiddenPaths`, `commands`, and score direction.
   - If `commands.verify` exists, treat it as verifier-only checks. Do not run it as proof of public/local score unless you are acting as the verifier.
3. Find the branded CLI:
   - Prefer `node ./challenges/<id>/bin/<cli>.js` from repo root.
   - If already inside the challenge directory, use the configured CLI command or `node bin/<cli>.js`.
4. Run baseline:

```bash
<cli> run
<cli> leaderboard
<cli> notes search "<current idea>"
```

## Iteration Rules

- Edit only paths in `editablePaths`.
- Never edit `forbiddenPaths`, harness files, stored runs, or generated verifier results.
- Make one focused change per iteration.
- Run tests through the CLI, not by manually invoking hidden assumptions.
- Keep a change only if correctness passes and the score improves enough to matter.
- Do not edit verifier-only or hidden-check scripts unless the user is designing the challenge, not solving it.
- Add a note for failed approaches:

```bash
<cli> notes add "Tried <approach>; failed because <reason>."
```

## Submission Loop

Use the full loop before reporting a result:

```bash
<cli> run
<cli> submit
<cli> verify --json --output .benchforge/verifier-result.json
<cli> submissions list
<cli> leaderboard
```

For a portable handoff to CI or another verifier:

```bash
<cli> submit --bundle-output .benchforge/latest.bundle.json
<cli> verify --bundle .benchforge/latest.bundle.json --json --output .benchforge/verifier-result.json
<cli> submissions export latest --output .benchforge/latest.bundle.json
<cli> submissions import .benchforge/latest.bundle.json
```

Treat `benchforge.submission.v1` bundles as the replayable artifact. Do not ask a solver to report only a score.

For a trusted CI or owner-controlled verifier:

```bash
<cli> verify --json --trusted --promote --verifier-kind github-actions --output .benchforge/verifier-result.json
<cli> export-site
```

If a hosted Benchforge API is configured, publish only trusted verifier results:

```bash
<cli> publish-verification --api "$BENCHFORGE_API_URL" --token "$BENCHFORGE_API_TOKEN"
<cli> hosted leaderboard --api "$BENCHFORGE_API_URL"
```

For shared agent memory:

```bash
<cli> hosted notes search "<current idea>" --api "$BENCHFORGE_API_URL"
<cli> hosted notes add "Tried <approach>; result <summary>." --api "$BENCHFORGE_API_URL" --token "$BENCHFORGE_API_TOKEN"
```

Report:

- local score
- accepted verifier score
- run id
- submission id
- whether the result is only local/accepted or truly remote verified
- whether `verifier.trusted` is true in the verifier result JSON
- whether the result was published to the hosted API

## Trust Language

Use precise status names:

- `local`: created on the submitter machine.
- `candidate`: packaged for verification.
- `accepted`: replayed through local/public checks.
- `verified`: reproduced by trusted remote verifier.
- `promoted`: reproduced by a trusted verifier and accepted onto the main public frontier.
- `replicated`: verified by more than one trusted environment.

Never call local or accepted results public proof.

Only publish to hosted leaderboards when `verifier.trusted` is true and the status is `verified`, `promoted`, or `replicated`. The hosted API may demote a requested `promoted` result to `verified` if it does not improve the public frontier.

## Creating New Challenges

For a new challenge, use:

```bash
node ./packages/core/src/cli.js create <challenge-id> --name "<Challenge Name>"
node ./challenges/<challenge-id>/bin/<challenge-id>.js run
```

Use `$benchmark-designer` first when the problem, scoring rule, or anti-cheat design is still unclear.
