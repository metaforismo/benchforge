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

## Factory Flow

```text
benchforge create grpoarena --name "GRPO Arena"
  create challenges/grpoarena/challenge.json
  create challenges/grpoarena/bin/grpoarena.js
  create starter solution
  create public harness
  create challenge README and SKILL.md

node ./challenges/grpoarena/bin/grpoarena.js run
  load challenges/grpoarena/challenge.json
  run that pack's harness
  store local run under challenges/grpoarena/.benchforge
```

The generated CLI wrapper is thin, but the generated challenge pack changes the actual benchmark behavior through its spec, editable paths, and harness.

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
  optionally emit benchforge.verification.v1 JSON
```

The local verifier is intentionally conservative about wording. It can mark a candidate `accepted` because it passed public checks from a package, but it does not make that result publicly trusted.

## Verifier Result Contract

`toyfail verify --json --output .benchforge/verifier-result.json` writes a stable JSON object:

```json
{
  "schemaVersion": "benchforge.verification.v1",
  "challenge": {
    "id": "toyfail",
    "name": "Toyfail",
    "version": "0.1.0"
  },
  "submission": {
    "id": "sub_...",
    "status": "accepted",
    "files": ["starter/solution.js"]
  },
  "verifier": {
    "kind": "local-public",
    "trusted": false
  },
  "result": {
    "status": "accepted",
    "runId": "run_...",
    "score": 12.3,
    "receiptHash": "..."
  },
  "receipt": {}
}
```

Hosted verifiers can keep the schema and change only `verifier.kind` and `verifier.trusted`.
