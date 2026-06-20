# Anti-Cheat Checklist

Use before accepting a benchmark design.

## Required

- Define the submitted artifact, not only the score.
- Rebuild from a clean baseline.
- Restrict editable paths.
- Hash or own the harness.
- Keep public tests useful but insufficient for promotion.
- Add verifier-only checks or hidden seeds.
- Emit machine-readable verifier results.
- Distinguish `local`, `accepted`, `verified`, `promoted`, and `replicated`.
- Record environment fingerprint for performance benchmarks.

## Red Flags

- The submitter reports a number but no replayable artifact.
- Correctness is judged by examples only.
- Faster score can be achieved by skipping work.
- Public data fully determines hidden evaluation.
- The benchmark depends on noisy timing but has no hardware track.
- The verifier runs untrusted code without sandboxing or isolation.
- Notes or telemetry influence leaderboard trust.

## Promotion Rule Patterns

- Promote only if trusted verifier reproduces correctness and score.
- Promote only if the candidate improves the current frontier by a minimum threshold.
- Promote into separate tracks when hardware or compute differs.
- Replicate top results on a second verifier before calling them strongest.

