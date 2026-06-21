# Submission Lifecycle

This page follows a submission from local iteration to public promotion.

## 1. Local Run

The solver runs:

```bash
<cli> run
```

Benchforge:

1. runs public tests,
2. runs the score command,
3. stores a `local` run in `.benchforge/`.

This is useful for iteration. It is not public proof.

## 2. Candidate Submission

The solver runs:

```bash
<cli> submit --bundle-output .benchforge/latest.bundle.json
```

Benchforge:

1. runs public tests,
2. runs the score command,
3. copies only files from `editablePaths`,
4. writes `submission.json`,
5. writes `submission.bundle.json`,
6. stores a `candidate` row.

The bundle is portable and replayable.

## 3. Local Replay

The solver can combine submit and local replay:

```bash
<cli> submit \
  --verify \
  --bundle-output .benchforge/latest.bundle.json \
  --output .benchforge/verifier-result.json
```

Benchforge:

1. copies the challenge to a temporary clean directory,
2. applies submitted editable files,
3. runs public tests,
4. runs optional verifier-only checks,
5. runs scoring,
6. writes a verifier result.

The result status is usually `accepted` unless trusted flags are used by an
owner-controlled verifier.

## 4. Audit Export

For review or GitHub provenance:

```bash
<cli> submissions audit latest --output .benchforge/audit-latest
```

The audit directory contains:

```text
README.md
submission.bundle.json
submission.json
files/
verifier-result.json
```

This can be pushed to a branch such as:

```text
submissions/<submission-id>
```

## 5. Trusted CI Replay

The owner runs the GitHub Actions verifier:

```text
workflow: Verify Bundle
challenge_path: challenges/toyfail
submission_ref: submissions/<submission-id>
bundle_path: submission.bundle.json
promote: true
publish_hosted: true or false
```

The workflow:

1. checks out trusted verifier code from the default branch,
2. checks out the submitted bundle from the submission ref,
3. runs `doctor --run --require-clean --expect-remote ...`,
4. verifies the bundle with trusted flags,
5. records the submitted commit URL,
6. uploads verifier artifacts,
7. optionally publishes to the hosted API.

## 6. Hosted Publish

The verifier result can be published:

```bash
<cli> publish-verification \
  --file .benchforge/verifier-result.json \
  --api "$BENCHFORGE_API_URL" \
  --token "$BENCHFORGE_API_TOKEN"
```

The hosted API should accept only trusted verifier results. It stores metadata
and exposes leaderboard JSON.

## Status Transitions

Typical path:

```text
local -> candidate -> accepted -> verified -> promoted
```

Meaning:

```text
local
  Produced by the solver's machine.

candidate
  Packaged but not replayed.

accepted
  Replayed locally or by an untrusted verifier.

verified
  Replayed by a trusted verifier.

promoted
  Trusted and accepted onto the public frontier.
```

## Metadata

Metadata travels with the bundle and verifier result:

```text
solver
model
modelFamily
note
commitUrl
```

Metadata helps humans inspect submissions. It does not determine score or trust.

Example:

```bash
<cli> submit \
  --verify \
  --solver "Ada" \
  --model "Claude Test" \
  --model-family "Claude" \
  --note "Removed redundant work after public correctness check."
```

GitHub Actions can add:

```bash
<cli> verify --bundle submission.bundle.json --commit-url https://github.com/owner/repo/commit/<sha>
```

## What To Store Where

Use local `.benchforge/` for:

- runs,
- notes,
- candidate submissions,
- bundles,
- receipts,
- reports.

Use GitHub for:

- source history,
- submission branches,
- audit directories,
- trusted CI logs,
- commit links.

Use Cloudflare/D1 for:

- public leaderboard metadata,
- trusted verifier result index,
- notes search,
- lightweight event telemetry.

Use external artifact storage when:

- submissions include large model weights,
- datasets are too large for bundles,
- logs or proof artifacts are large but still need hashes.

