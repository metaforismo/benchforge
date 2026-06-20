# Benchforge Hosted

Benchforge Hosted is an optional Cloudflare Worker + D1 API for public leaderboards.

It is intentionally small:

- public reads for challenges, leaderboards, and notes
- authenticated writes for trusted verifier results, notes, and CLI events
- D1 storage for metadata
- no online heavy benchmark execution

Heavy verification should run on a trusted runner such as GitHub Actions. The runner writes a `benchforge.verification.v1` JSON file, then publishes that result to this Worker.

## Deploy

Install Wrangler:

```bash
npm install -D wrangler@latest
```

Create the database:

```bash
npx wrangler d1 create benchforge
```

Copy the returned database id into `packages/hosted/wrangler.jsonc`.

Apply the schema:

```bash
npx wrangler d1 execute benchforge --remote --file packages/hosted/schema.sql
```

Set the write token:

```bash
npx wrangler secret put BENCHFORGE_RUNNER_TOKEN --config packages/hosted/wrangler.jsonc
```

Deploy:

```bash
npx wrangler deploy --config packages/hosted/wrangler.jsonc
```

## Publish A Trusted Result

After a trusted runner creates `.benchforge/verifier-result.json`:

```bash
BENCHFORGE_API_URL=https://benchforge-hosted.example.workers.dev \
BENCHFORGE_API_TOKEN=secret \
node ./challenges/toyfail/bin/toyfail.js publish-verification
```

Read the hosted leaderboard:

```bash
BENCHFORGE_API_URL=https://benchforge-hosted.example.workers.dev \
node ./challenges/toyfail/bin/toyfail.js hosted leaderboard
```

## Trust Model

Do not publish local-only results to the public leaderboard. The Worker rejects untrusted verifier results and accepts only `verified`, `promoted`, or `replicated` statuses from a caller that knows `BENCHFORGE_RUNNER_TOKEN`.

The Worker also enforces a frontier rule: a trusted `promoted` result only stays `promoted` if it improves the current public best score. Otherwise it is stored as `verified`.

That keeps the expensive benchmark off the Worker while still making the public leaderboard hard to cheat: the public API stores results from a trusted reproducible runner, not self-reported scores.

Keep `BENCHFORGE_RUNNER_TOKEN` in owner-controlled CI or verifier infrastructure only. If a solver has that token, they can publish results as trusted.
