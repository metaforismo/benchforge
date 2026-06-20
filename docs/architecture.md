# Architecture

Benchforge separates the reusable benchmark engine from challenge-specific packs.

```text
Branded CLI
  toyfail
  rckfail
  grpoarena

Benchforge Core
  spec loading
  doctor preflight
  command execution
  local store
  notes
  submissions
  receipts
  leaderboard
  report export
  hosted API client

Challenge Pack
  challenge.json or benchmark.json
  harness/
  starter/
  SKILL.md

Hosted Layer
  Cloudflare Worker API
  D1 metadata database
  trusted verifier-result ingestion
  public leaderboard endpoints
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

The MVP implements local runs, local receipts, trusted verifier-result ingestion, and hosted public leaderboard states. Direct public solver submission is intentionally a later layer.

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

Benchforge loads `challenge.json` first. If it is absent, it falls back to a
minimal ECDSA.fail-style `benchmark.json` with `editablePaths`,
`setupCommand`, `benchmarkCommand`, and `scorePath`. Command values can be shell
strings or argv arrays such as `["bash", "-lc", "./benchmark.sh"]`.

`doctor --run` is the preflight command for both humans and agents. It reports
the challenge root, editable files, forbidden path coverage, optional verifier
checks, hosted API config, bundle support, and git context. If a challenge
declares an expected `source.repository`, a mismatched or missing git context is
a failure. This is the guardrail for future forceful sync/update workflows.

## Skill Layer

Benchforge uses two repository-level skills:

```text
skills/benchmark-designer
  Use before implementation.
  Ask high-value design questions.
  Select benchmark archetype.
  Threat-model cheating.
  Produce challenge contract.

skills/benchforge
  Use inside a challenge.
  Read challenge.json.
  Respect editable and forbidden paths.
  Run baseline, notes, submit, verify, leaderboard.
  Report trust status precisely.
```

Each generated challenge also gets a challenge-specific `SKILL.md` so an agent can be pointed directly at the challenge.

## Local Submission Flow

```text
toyfail submit
  run public tests
  run score command
  copy editable files into .benchforge/submissions/<id>/files
  write submission.json
  write submission.bundle.json
  store candidate row

toyfail submissions audit <id>
  write a GitHub-friendly artifact directory
  include submission.bundle.json, submission.json, files/, README.md
  include verifier-result.json when the submission has been verified

toyfail verify <id>
  copy challenge into a temporary clean directory
  apply packaged editable files
  run public tests
  run optional verifier-only command from commands.verify
  run score command
  store accepted run
  write receipt
  optionally emit benchforge.verification.v1 JSON
```

The local verifier is intentionally conservative about wording. It can mark a candidate `accepted` because it passed public checks from a package, but it does not make that result publicly trusted.

## Submission Bundle Contract

`submit` writes a portable JSON bundle:

```json
{
  "schemaVersion": "benchforge.submission.v1",
  "challenge": { "id": "toyfail", "version": "0.1.0" },
  "submission": {
    "id": "sub_...",
    "editablePaths": ["starter/solution.js"],
    "files": ["starter/solution.js"]
  },
  "files": [
    {
      "path": "starter/solution.js",
      "size": 1234,
      "sha256": "...",
      "contentBase64": "..."
    }
  ],
  "bundleHash": "..."
}
```

The bundle hash covers challenge metadata, candidate metadata, file paths, file hashes, and file contents. `verify --bundle <file>` imports the bundle, rejects tampering, applies only allowed editable files, and then runs the same verifier flow.

## Verifier Result Contract

`toyfail verify --json --output .benchforge/verifier-result.json` writes a stable JSON object:

```json
{
  "schemaVersion": "benchforge.verification.v1",
  "challenge": {
    "id": "toyfail",
    "name": "Toyfail",
    "version": "0.1.0",
    "scoreDirection": "minimize",
    "primaryMetric": "time_ms"
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

Trusted CI verifier example:

```bash
toyfail verify --json --trusted --promote --verifier-kind github-actions --output .benchforge/verifier-result.json
```

This produces a `promoted` run with `verifier.trusted: true`. Local verifier results should keep `trusted: false`.

## Leaderboard Export

`export-site` writes two files:

```text
.benchforge/site/index.html
.benchforge/site/leaderboard.json
```

`leaderboard.json` uses `benchforge.leaderboard.v1` and contains:

- challenge metadata
- run counts by status
- best public score
- best local/any score
- ranked entries
- score history

The HTML is a static view over the same data and can be uploaded as an artifact, served locally, or later deployed to Pages/Cloudflare.

## Hosted Submission Flow

```text
GitHub Actions or trusted runner
  run challenge tests
  run challenge score
  toyfail verify --trusted --promote --verifier-kind github-actions --json --output .benchforge/verifier-result.json
  toyfail publish-verification --api "$BENCHFORGE_API_URL" --token "$BENCHFORGE_API_TOKEN"

Cloudflare Worker
  require bearer token for writes
  reject untrusted verifier results
  demote non-frontier promoted requests to verified
  store challenge/submission/run metadata in D1
  expose public leaderboard JSON
```

This keeps benchmark execution away from the hosted API. D1 stores official metadata, not self-reported local scores.

Direct ECDSA.fail-style CLI submissions can be added later with the same trust boundary: upload editable paths, verify elsewhere, then publish only reproduced results.

## GitHub Audit Trail

Cloudflare/D1 is the fast public index for leaderboards, notes, and telemetry.
GitHub can also be used as an audit trail:

```text
solver
  produce benchforge.submission.v1 bundle
  optionally export audit directory and push it to submissions/<uuid>

trusted verifier
  checks out the submission branch or imports the bundle
  runs verify --trusted
  publishes verifier-result JSON to Cloudflare
  optionally commits "Accept submission <uuid>" to main
```

This mirrors the useful part of the ECDSA.fail pattern without making GitHub the
only source of truth. The portable bundle remains the neutral artifact; GitHub
and D1 are two indexes over the same verifier result.

The included `.github/workflows/verify-bundle.yml` implements the trusted
GitHub Actions path as a manual workflow. It takes `challenge_path` and
`bundle_path`, verifies the bundle with `--trusted --verifier-kind
github-actions`, uploads verifier artifacts, and can optionally publish to the
hosted API when secrets are configured.
