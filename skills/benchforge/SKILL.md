---
name: benchforge
description: Work inside Benchforge benchmark challenges and branded CLIs. Use when optimizing a challenge, running local benchmarks, packaging candidate submissions, verifying verifier-result JSON, reading or writing challenge notes, respecting editable/forbidden paths, or helping an agent iterate on a Benchforge-generated arena such as toyfail, rckfail, grpoarena, or similar CLI/leaderboard benchmarks.
---

# Benchforge

Use this skill when working inside a Benchforge challenge.

## First Pass

1. Read `challenge.json`.
2. Identify `cli`, `editablePaths`, `forbiddenPaths`, `commands`, and score direction.
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

Report:

- local score
- accepted verifier score
- run id
- submission id
- whether the result is only local/accepted or truly remote verified

## Trust Language

Use precise status names:

- `local`: created on the submitter machine.
- `candidate`: packaged for verification.
- `accepted`: replayed through local/public checks.
- `verified`: reproduced by trusted remote verifier.
- `promoted`: accepted onto the main public leaderboard.
- `replicated`: verified by more than one trusted environment.

Never call local or accepted results public proof.

## Creating New Challenges

For a new challenge, use:

```bash
node ./packages/core/src/cli.js create <challenge-id> --name "<Challenge Name>"
node ./challenges/<challenge-id>/bin/<challenge-id>.js run
```

Use `$benchmark-designer` first when the problem, scoring rule, or anti-cheat design is still unclear.

