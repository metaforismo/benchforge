# Update Safety

Agents can run commands from the wrong directory. If a CLI has a forceful sync
or update command, that mistake can overwrite an unrelated repository.

Benchforge treats update safety as a first-class benchmark feature.

## Rule

Before any command that overwrites, resets, syncs, or force-updates files, run:

```bash
<cli> doctor --require-clean --expect-remote https://github.com/owner/challenge
```

Proceed only when:

- `git-context` passes,
- `git-clean` passes,
- the challenge root is the intended root,
- the expected remote matches the current repository.

## What The Checks Mean

`git-context` confirms:

- the challenge root is inside a Git repository,
- the repository remote matches the expected challenge repository.

`git-clean` confirms:

- there are no uncommitted changes.

This protects:

- solver work,
- unrelated repositories,
- challenge harness files,
- generated artifacts.

## Challenge Spec Remote

Challenge authors can put the expected repository in `challenge.json`:

```json
{
  "source": {
    "repository": "https://github.com/owner/challenge"
  }
}
```

Then `doctor` can check the configured remote without passing
`--expect-remote` every time.

## Safe Update Protocol For Agents

Use this protocol:

```bash
<cli> doctor --require-clean --expect-remote https://github.com/owner/challenge
```

If it fails, stop.

If useful local work exists, export it before asking for help:

```bash
<cli> submissions export latest --output .benchforge/latest.bundle.json
<cli> submissions audit latest --output .benchforge/audit-latest
```

Only after the guard passes should an agent run a future command such as:

```bash
<cli> sync
<cli> update
<cli> update --force
```

Benchforge does not currently implement a destructive sync command. This page
defines the required safety gate for one.

## CI Protocol

GitHub Actions should also use the guard:

```bash
node ./packages/core/src/cli.js doctor \
  --run \
  --require-clean \
  --expect-remote "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY"
```

This catches broken workflow paths and repository mismatches before verifier
work begins.

## Human Recovery

If an update check fails:

1. Run `git status`.
2. Confirm the current directory.
3. Confirm `git remote -v`.
4. Export useful `.benchforge` artifacts if needed.
5. Commit, stash, or move local changes intentionally.
6. Re-run the guard.

Do not fix a failed guard by weakening the guard.

