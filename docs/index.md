# Benchforge Documentation

Benchforge is a local-first factory for benchmark arenas: a reusable engine for
challenge-specific CLIs, replayable submissions, verifier receipts, public
leaderboards, and optional hosted coordination.

The project is designed for two audiences:

- humans who want to launch and operate benchmark challenges,
- agents that need precise rules for iterating without cheating or damaging the
  repository.

## Start Here

If you want to understand the product:

1. Read [Concepts](./concepts.md).
2. Run the toy challenge in [Getting Started](./getting-started.md).
3. Read [Submission Lifecycle](./submission-lifecycle.md).

If you want to create a new challenge:

1. Read [Challenge Author Guide](./challenge-author-guide.md).
2. Fill [Design Questionnaire](./design-questionnaire.md).
3. Pick a starting point from [Challenge Recipes](./challenge-recipes.md).
4. Use [Trust And Anti-Cheat](./trust-and-anti-cheat.md) while designing the
   verifier.
5. Check [CLI Reference](./cli-reference.md) while testing the generated CLI.

If you are an agent:

1. Read [Agent Guide](./agent-guide.md).
2. Follow [Update Safety](./update-safety.md) before any overwrite, sync, or
   forceful operation.
3. Use the challenge-specific `SKILL.md` when present.

If you want a public leaderboard:

1. Use [GitHub Actions Verifier](./github-actions-verifier.md) for trusted CI
   replay.
2. Use [Hosted Cloudflare Layer](./hosted-cloudflare.md) when you want public
   notes, search, telemetry, and fast leaderboard reads.
3. Read [ECDSA.fail Pattern Notes](./ecdsafail-patterns.md) for the design
   comparison that inspired Benchforge.

## Documentation Map

- [Concepts](./concepts.md): mental model, trust tiers, local-first design.
- [Getting Started](./getting-started.md): clone, test, run `toyfail`, export a
  report.
- [CLI Reference](./cli-reference.md): commands, flags, metadata fields, common
  recipes.
- [Challenge Author Guide](./challenge-author-guide.md): how to turn a problem
  into a benchmark arena.
- [Design Questionnaire](./design-questionnaire.md): questions that define the
  benchmark contract.
- [Challenge Recipes](./challenge-recipes.md): reusable blueprints for ML,
  math, algorithm, systems, and existing-repo challenges.
- [Agent Guide](./agent-guide.md): how agents should iterate, note failures,
  submit, and report trust status.
- [Trust And Anti-Cheat](./trust-and-anti-cheat.md): threat model and verifier
  design.
- [Submission Lifecycle](./submission-lifecycle.md): candidate bundles,
  verification, audit artifacts, public promotion.
- [Update Safety](./update-safety.md): guardrails for `sync`, update, and
  repository context checks.
- [Architecture](./architecture.md): engine, challenge packs, hosted API, GitHub
  audit trail.
- [GitHub Actions Verifier](./github-actions-verifier.md): trusted CI replay
  workflow.
- [Hosted Cloudflare Layer](./hosted-cloudflare.md): Worker + D1 metadata layer.
- [ECDSA.fail Pattern Notes](./ecdsafail-patterns.md): what Benchforge borrows
  and what it intentionally does differently.

## Core Promise

Benchforge does not make a local score public truth. A solver can run and submit
locally, but public trust comes from replaying a portable artifact in a trusted
environment.

That is the central rule:

```text
local result -> useful for iteration
candidate bundle -> useful for handoff
accepted result -> replayed locally
verified/promoted result -> replayed by a trusted verifier
```
