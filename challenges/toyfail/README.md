# Toyfail

Toyfail is the first Benchforge demo challenge.

Goal: make `starter/solution.js` faster without changing behavior.

Allowed edits:

- `starter/solution.js`

Run:

```bash
npm run toyfail:doctor
npm run toyfail:run
npm run toyfail:submit:verify
npm run toyfail:verify:json
npm run toyfail:submissions
npm run toyfail:audit
npm run toyfail:leaderboard
npm run toyfail:report
```

Local scores are useful for iteration. Public trust requires an independent verifier.

Run `npm run toyfail:doctor` before any forceful update or sync workflow. A public challenge can declare an expected `source.repository`; if the git context does not match, stop instead of forcing an update.
