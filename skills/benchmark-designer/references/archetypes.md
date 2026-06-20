# Benchmark Archetypes

Use this reference when choosing a benchmark shape.

## Algorithm Performance

- Artifact: source patch.
- Correctness: reference implementation, property tests, randomized seeds.
- Score: time, memory, operations, or weighted objective.
- Anti-cheat: hidden seeds, clean checkout, fixed input generator, forbidden harness edits.
- Tracks: CPU, GPU, macOS/Metal, CUDA, hardware class.

## Mathematical Proof Or Witness

- Artifact: proof, witness, construction, or verifier program.
- Correctness: machine-checkable verifier whenever possible.
- Score: proof size, witness size, runtime, bound improved, counterexample strength.
- Anti-cheat: independent verifier, randomized checks, formal checker, public statement of theorem.

## ML Fixed-Budget Search

- Artifact: training script, config, architecture, or generated model.
- Correctness: hidden validation/test split, deterministic eval script.
- Score: accuracy/loss/reward under fixed wall time, tokens, FLOPs, or parameter budget.
- Anti-cheat: sealed eval data, no network, frozen budget, logged seeds, model card.

## Systems Or Compiler Optimization

- Artifact: patch, pass, kernel, query plan, runtime flag.
- Correctness: conformance tests and differential testing.
- Score: throughput, latency, memory, energy proxy.
- Anti-cheat: workload suite, hidden cases, environment fingerprint, separate leaderboards by hardware.

## Search / Autoresearch Challenge

- Artifact: final candidate plus notes.
- Correctness: domain verifier.
- Score: best frontier movement.
- Anti-cheat: candidate replay, notes advisory only, promoted entries require trusted verification.

