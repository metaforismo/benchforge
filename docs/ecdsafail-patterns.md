# ECDSA.fail Pattern Notes

This is a design comparison against the public `ecdsafail/ecdsafail-challenge`
repository, used as inspiration rather than as a target-specific dependency.

Sources inspected:

- <https://github.com/ecdsafail/ecdsafail-challenge>
- <https://github.com/ecdsafail/ecdsafail-challenge/blob/main/benchmark.json>
- <https://github.com/ecdsafail/ecdsafail-challenge/blob/main/benchmark.sh>
- <https://github.com/ecdsafail/ecdsafail-challenge/pulls>

## What ECDSA.fail Gets Right

- The challenge contract is tiny. `benchmark.json` declares name, category,
  direction, editable paths, setup command, benchmark command, and score path.
- The participant UX is very short: install CLI, login, clone, edit, run,
  submit.
- The README is precise about the mathematical/engineering contract, the score,
  what can be edited, and what is forbidden.
- The harness writes a standard `score.json` with `score` and `metrics`.
- The benchmark script deletes stale outputs before scoring.
- Untrusted contestant code is separated from trusted scoring. In that repo,
  `build_circuit` is treated as untrusted and `eval_circuit` is the trusted
  scorer.
- The untrusted phase is sandboxed when possible, with no network and a
  throwaway writable directory.
- GitHub appears to serve as an audit trail: many active branches are named
  `submissions/<uuid>`, while accepted results land as commits on `main` with
  messages like `Accept submission <uuid>`.
- Pull requests are not the main score channel. They are used more for tooling
  or research changes, such as optional profiling tools.
- Community feedback around `ecdsafail sync --force` exposed an important agent
  safety issue: an agent can run a forceful sync from the wrong working
  directory and overwrite a different git repo. The right fix is not simply a
  scarier flag name; the CLI should verify the challenge marker and expected git
  remote before any forceful operation.

## What Benchforge Should Keep Different

Benchforge is meant to create many challenge arenas, not one ECDSA-specific
arena. The reusable pieces should live in the engine, while each challenge pack
stays small:

- `challenge.json` is the general contract.
- `benchmark.json` is supported as a minimal ECDSA.fail-style contract.
- `harness/` owns domain-specific testing and scoring.
- `starter/` or equivalent editable paths are the participant surface.
- `SKILL.md` gives agents local rules.
- `.benchforge/` stores local runs, notes, bundles, receipts, and report output.

That makes Benchforge more flexible than the ECDSA.fail challenge repo, but it
also means the surface can feel more complex. The product rule is:

> Keep the solver flow ECDSA.fail-simple; keep the verifier/trust machinery
> available but mostly hidden until needed.

## Recommended Default Flow

For local iteration:

```bash
<cli> setup
<cli> doctor --run
<cli> run
<cli> submit --verify --bundle-output .benchforge/latest.bundle.json --output .benchforge/verifier-result.json
<cli> leaderboard
```

`setup` is optional and only exists when the challenge declares `commands.setup`
or `setupCommand`.

For public trust:

```bash
<cli> verify --bundle .benchforge/latest.bundle.json --trusted --promote --verifier-kind github-actions --json --output .benchforge/verifier-result.json
<cli> publish-verification --api "$BENCHFORGE_API_URL" --token "$BENCHFORGE_API_TOKEN"
```

The first flow is simple enough for agents and local sharing. The second flow is
for owner-controlled CI or a hosted verifier.

## GitHub Versus Database

The right answer is not one or the other.

Use GitHub as an audit/log layer when:

- you want public provenance,
- submissions should be inspectable as code history,
- a small/medium challenge can tolerate repository churn,
- GitHub Actions is the trusted verifier.

Use a database/hosted API when:

- the leaderboard needs fast queries,
- notes/search/telemetry matter,
- there are many submissions,
- you want public reads without cloning a large repo.

Benchforge should support both:

- portable signed-ish bundles as the neutral artifact,
- GitHub branches or commits as an optional audit trail,
- Cloudflare/D1 as an optional leaderboard and notes index.

## Anti-Cheat Lessons To Carry Forward

- Always delete stale score outputs before running score commands.
- Refuse forceful sync/update commands unless the challenge root and expected
  git remote match.
- Treat local scores as iteration only.
- Package only declared editable paths.
- Hash every submitted file and the whole bundle.
- Re-run submissions in a clean copy.
- Add verifier-only checks where the public harness can be overfit.
- Prefer a trusted scorer that does not import contestant code when the domain
  allows it.
- Sandbox untrusted build/execution for public verification.
- Keep the final public status vocabulary strict: candidate, accepted, verified,
  promoted, replicated.

## Current Benchforge Assessment

Benchforge is more general and more audit-ready than the single ECDSA.fail
challenge repo. It is also more complex. The intended correction is not to
remove bundles, receipts, hosted APIs, or verifier status. The correction is to
make the default command path short and obvious, while preserving those layers
for public deployments.
