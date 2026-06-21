# Getting Started

This guide runs the included `toyfail` challenge end to end.

## Requirements

- Node.js 20 or newer.
- Git.
- No hosted services are required for local use.

Check the repository:

```bash
npm test
npm run hosted:test
npm run skills:validate
```

## Run The Demo Challenge

Run the preflight:

```bash
npm run toyfail:doctor
```

Run the benchmark locally:

```bash
npm run toyfail:run
```

Show the local leaderboard:

```bash
npm run toyfail:leaderboard
```

## Submit And Verify Locally

Package the editable files, replay the package locally, and write a verifier
result:

```bash
npm run toyfail:submit:verify
```

The important outputs are:

```text
challenges/toyfail/.benchforge/latest.bundle.json
challenges/toyfail/.benchforge/verifier-result.json
```

The bundle is the replayable submission artifact. The verifier result records
what happened during local replay.

## Add Metadata

Metadata helps humans and agents understand the submission. It is not trusted
scoring data.

```bash
node ./challenges/toyfail/bin/toyfail.js submit \
  --verify \
  --bundle-output .benchforge/latest.bundle.json \
  --output .benchforge/verifier-result.json \
  --solver "Ada" \
  --model "Claude Test" \
  --model-family "Claude" \
  --note "Small optimization that keeps the public invariant intact."
```

## Export A Report

```bash
npm run toyfail:report
```

Open:

```text
challenges/toyfail/.benchforge/site/index.html
```

The report includes:

- best public and local scores,
- score history,
- ranked entries,
- solver/model metadata,
- score diff,
- note details,
- optional commit links.

## Export An Audit Directory

```bash
npm run toyfail:audit
```

This writes:

```text
challenges/toyfail/.benchforge/audit-latest/
```

The audit directory contains the bundle, metadata, submitted files, and verifier
result when available. It is suitable for a GitHub branch, pull request, issue
attachment, or manual review.

## Create A New Challenge

```bash
node ./packages/core/src/cli.js create grpoarena --name "GRPO Arena"
node ./challenges/grpoarena/bin/grpoarena.js doctor --run
node ./challenges/grpoarena/bin/grpoarena.js run
```

The generated CLI is real. It loads the shared Benchforge engine but uses the
generated challenge pack, so benchmark behavior is controlled by that pack's
`challenge.json`, `starter/`, and `harness/`.

