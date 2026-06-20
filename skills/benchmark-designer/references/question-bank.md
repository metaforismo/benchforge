# Benchmark Design Question Bank

Use selectively. Do not dump every question on the user.

## Domain

- What would count as a real scientific or engineering improvement?
- Is the interesting frontier speed, accuracy, proof strength, memory, cost, robustness, or simplicity?
- Is the problem mature enough to have a reference implementation or oracle?

## Artifact

- What exactly can solvers change?
- Should submissions be patches, files, model weights, configs, generated outputs, or proofs?
- Can the artifact be replayed without trusting the submitter's machine?

## Scoring

- Is the score minimized or maximized?
- What secondary metrics should break ties?
- What budget prevents brute force or runaway compute?
- Should there be multiple tracks?

## Verification

- What tests can be public without giving away the benchmark?
- What must remain verifier-only?
- Can GitHub Actions verify it, or does it need Mac/GPU/private hardware?
- What makes a result promoted rather than merely accepted?

## Cheating

- How could a solver hardcode the benchmark?
- How could a solver tamper with the harness?
- How could an ML submission leak eval data?
- How could a timing benchmark be gamed by hardware or environment?

