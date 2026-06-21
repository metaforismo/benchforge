# CLI Reference

Benchforge has two CLI layers:

- `benchforge`: the factory CLI.
- `<challenge-cli>`: a generated branded CLI such as `toyfail`, `rckfail`, or
  `grpoarena`.

In this repository, examples use:

```bash
node ./packages/core/src/cli.js
node ./challenges/toyfail/bin/toyfail.js
```

## Factory Commands

### `create`

Create a new challenge pack.

```bash
node ./packages/core/src/cli.js create <id> --name "<Name>"
```

Options:

```text
--name <name>   Human-readable challenge name.
--cli <cli>     Optional CLI name when different from the id.
--root <path>   Output directory. Defaults to the current directory.
--force         Allow writing into an existing challenge directory.
```

Generated files include:

```text
challenges/<id>/challenge.json
challenges/<id>/bin/<cli>.js
challenges/<id>/starter/solution.js
challenges/<id>/harness/test.js
challenges/<id>/harness/score.js
challenges/<id>/README.md
challenges/<id>/SKILL.md
```

## Challenge Commands

### `setup`

Run the optional challenge setup command.

```bash
<cli> setup
```

Fails when neither `commands.setup` nor `setupCommand` is configured.

### `doctor`

Preflight the challenge.

```bash
<cli> doctor
<cli> doctor --run
<cli> doctor --json
<cli> doctor --require-clean --expect-remote https://github.com/owner/repo
```

Checks include:

- challenge spec loading,
- editable files,
- forbidden path coverage,
- verifier command presence,
- setup command presence,
- score output path,
- hosted API config,
- submission bundle support,
- challenge root,
- git context,
- optional clean worktree,
- optional public tests, verifier checks, and scoring.

Use `--require-clean --expect-remote <url>` before any sync, update, force
checkout, or overwrite operation.

### `test`

Run public correctness tests only.

```bash
<cli> test
```

### `score`

Run the score command only and print JSON.

```bash
<cli> score
```

The score command must write the configured score file, usually `score.json`:

```json
{
  "score": 12.3,
  "metrics": {
    "time_ms": 12.3,
    "correctness_cases": 64
  }
}
```

### `run`

Run public tests, score, and store a local run.

```bash
<cli> run
```

This produces a `local` run. It is useful for iteration, not public proof.

### `submit`

Run public tests, score, and package current editable files as a candidate.

```bash
<cli> submit
```

Common options:

```text
--bundle-output <path>   Copy the portable bundle to a chosen path.
--verify                 Immediately replay the candidate locally.
--output <path>          Write verifier-result JSON when --verify is used.
--trusted                Mark verifier replay as trusted. Owner/CI only.
--promote                Request promoted status. Requires --trusted.
--verifier-kind <kind>   Example: github-actions, local-public.
--solver <name>          Descriptive metadata.
--model <name>           Descriptive metadata.
--model-family <family>  Descriptive metadata.
--note <text>            Descriptive metadata.
--commit-url <url>       Descriptive metadata.
```

Example:

```bash
<cli> submit \
  --verify \
  --bundle-output .benchforge/latest.bundle.json \
  --output .benchforge/verifier-result.json \
  --solver "Ada" \
  --model "Claude Test" \
  --note "Removed unnecessary work while preserving correctness."
```

### `verify`

Replay a candidate submission.

```bash
<cli> verify
<cli> verify <submission-id>
<cli> verify --bundle .benchforge/latest.bundle.json
```

Options:

```text
--json                   Print verifier-result JSON.
--output <path>          Write verifier-result JSON.
--bundle <path>          Import and verify a portable bundle.
--trusted                Trusted verifier mode. Owner/CI only.
--promote                Request promoted status. Requires --trusted.
--verifier-kind <kind>   Label the verifier environment.
--commit-url <url>       Add provenance metadata.
--solver <name>          Add or override metadata.
--model <name>           Add or override metadata.
--model-family <family>  Add or override metadata.
--note <text>            Add or override metadata.
```

Trusted GitHub Actions example:

```bash
<cli> verify \
  --bundle .benchforge/latest.bundle.json \
  --json \
  --trusted \
  --promote \
  --verifier-kind github-actions \
  --commit-url https://github.com/owner/repo/commit/<sha> \
  --output .benchforge/verifier-result.json
```

### `submissions`

List, import, export, or audit submissions.

```bash
<cli> submissions list
<cli> submissions export latest --output .benchforge/latest.bundle.json
<cli> submissions import .benchforge/latest.bundle.json
<cli> submissions audit latest --output .benchforge/audit-latest
```

`submissions audit` writes a reviewable directory with bundle, metadata,
submitted files, README, and verifier result when available.

### `leaderboard`

Print local leaderboard rows.

```bash
<cli> leaderboard
```

### `notes`

Store local notes for humans and agents.

```bash
<cli> notes add "Tried vectorized path; failed hidden invariant."
<cli> notes search "vectorized"
```

### `export-site`

Write a static local report.

```bash
<cli> export-site
```

Outputs:

```text
.benchforge/site/index.html
.benchforge/site/leaderboard.json
```

### `hosted`

Read or write hosted metadata when a Cloudflare API is configured.

```bash
<cli> hosted leaderboard --api "$BENCHFORGE_API_URL"
<cli> hosted notes search "idea" --api "$BENCHFORGE_API_URL"
<cli> hosted notes add "Tried idea; result summary." --api "$BENCHFORGE_API_URL" --token "$BENCHFORGE_API_TOKEN"
```

### `publish-verification`

Publish a trusted verifier-result JSON to the hosted API.

```bash
<cli> publish-verification \
  --file .benchforge/verifier-result.json \
  --api "$BENCHFORGE_API_URL" \
  --token "$BENCHFORGE_API_TOKEN"
```

Only publish results where:

- `verifier.trusted` is `true`,
- status is `verified`, `promoted`, or `replicated`,
- the runner is owner-controlled.

