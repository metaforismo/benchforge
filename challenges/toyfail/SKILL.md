---
name: toyfail
description: Work on the Toyfail Benchforge challenge. Use when optimizing Toyfail's starter solution, running the toyfail CLI, submitting candidate packages, verifying verifier-result JSON, reading notes, or respecting Toyfail editable and forbidden paths.
---

# Toyfail Agent Skill

You are working on Toyfail, a local-first Benchforge challenge.

Objective: minimize `time_ms` while preserving the behavior of `starter/solution.js`.

Editable files:

- `starter/solution.js`

Do not edit:

- `harness/`
- `challenge.json`
- `.benchforge/` except through the CLI

Commands:

```bash
npm run toyfail:run
npm run toyfail:submit
npm run toyfail:verify:json
npm run toyfail:verify:trusted
npm run toyfail:submissions
npm run toyfail:leaderboard
npm run toyfail:report
```

Portable bundle flow:

```bash
node ./challenges/toyfail/bin/toyfail.js submit --bundle-output .benchforge/latest.bundle.json
node ./challenges/toyfail/bin/toyfail.js verify --bundle .benchforge/latest.bundle.json --json --output .benchforge/verifier-result.json
node ./challenges/toyfail/bin/toyfail.js submissions export latest --output .benchforge/latest.bundle.json
node ./challenges/toyfail/bin/toyfail.js submissions import .benchforge/latest.bundle.json
```

Hosted commands, when `BENCHFORGE_API_URL` is configured:

```bash
node ./challenges/toyfail/bin/toyfail.js publish-verification
node ./challenges/toyfail/bin/toyfail.js hosted leaderboard
node ./challenges/toyfail/bin/toyfail.js hosted notes search "idea"
```

When an approach fails, add a note:

```bash
node ./challenges/toyfail/bin/toyfail.js notes add "Describe the failed approach and why it failed"
```

Only trust a score after tests pass and the CLI records a run.

Use `submit` to package a candidate and `verify` to replay that package through public checks. Prefer `npm run toyfail:verify:json` when another tool needs a local machine-readable verifier result. Use `npm run toyfail:verify:trusted` only in owner-controlled CI or a trusted verifier. Treat `accepted` as local-public-check status, not as public leaderboard proof. Publish hosted results only after a trusted verifier result exists.
