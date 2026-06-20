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
