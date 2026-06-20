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
npm run toyfail:submissions
npm run toyfail:leaderboard
npm run toyfail:report
```

When an approach fails, add a note:

```bash
node ./challenges/toyfail/bin/toyfail.js notes add "Describe the failed approach and why it failed"
```

Only trust a score after tests pass and the CLI records a run.

Use `submit` to package a candidate and `verify` to replay that package through public checks. Prefer `npm run toyfail:verify:json` when another tool or CI needs a machine-readable verifier result. Treat `accepted` as local-public-check status, not as public leaderboard proof.
