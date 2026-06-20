# Architecture

Benchforge separates the reusable benchmark engine from challenge-specific packs.

```text
Branded CLI
  toyfail
  rckfail
  grpoarena

Benchforge Core
  spec loading
  command execution
  local store
  notes
  submissions
  receipts
  leaderboard
  report export

Challenge Pack
  challenge.json
  harness/
  starter/
  SKILL.md
```

Local results are not public proof. A hosted/community deployment should promote only results reproduced by a trusted verifier.

## Trust Tiers

```text
local
  Produced by the submitter's machine.

accepted
  Submission format is valid.

verified
  Reproduced by one trusted verifier.

promoted
  Shown on the main leaderboard.

replicated
  Reproduced by multiple verifier environments.
```

The MVP implements local runs and local receipts. Hosted verification will add accepted, verified, promoted, and replicated states.

## Local Submission Flow

```text
toyfail submit
  run public tests
  run score command
  copy editable files into .benchforge/submissions/<id>/files
  write submission.json
  store candidate row

toyfail verify <id>
  copy challenge into a temporary clean directory
  apply packaged editable files
  run public tests
  run score command
  store accepted run
  write receipt
```

The local verifier is intentionally conservative about wording. It can mark a candidate `accepted` because it passed public checks from a package, but it does not make that result publicly trusted.
