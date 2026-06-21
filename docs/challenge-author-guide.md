# Challenge Author Guide

This guide explains how to turn a vague problem into a Benchforge challenge.

## The Author's Job

A challenge author defines:

- the artifact solvers submit,
- the files solvers may edit,
- the files solvers must not edit,
- the public correctness checks,
- the verifier-only checks,
- the scoring command,
- the score direction,
- the public promotion rule,
- the environment used for trusted verification.

Good benchmark design is mostly about making the score hard to fake.

## Start From The Artifact

Decide what a solver is allowed to submit:

```text
code patch
model weights
training script
configuration
mathematical proof
witness
circuit description
dataset transform
compiled binary
benchmark log
```

The current core bundle is best for code and small text artifacts inside
`editablePaths`. Larger artifacts such as weights, datasets, or logs should be
handled by a challenge-specific artifact policy, usually by storing references
or hashes in editable files and keeping the large files in an external store.

## Pick An Archetype

Common challenge archetypes:

```text
optimization
  Minimize time, memory, operations, gates, loss, or cost.

correctness-first algorithm
  Public tests prove basic behavior; verifier tests prevent hardcoding.

machine learning
  Public smoke test plus verifier dataset, fixed budget, deterministic scoring.

mathematics
  Submit proof/witness/construction; verifier checks the certificate.

systems
  Fixed runner, strict resource limits, benchmark repetitions, noise controls.

cryptography
  Separate untrusted construction from trusted evaluation.
```

## Design The Score

A score should be:

- numeric,
- monotonic,
- reproducible enough to rank,
- tied to the real objective,
- impossible to improve by skipping work,
- hard to overfit to public tests.

Examples:

```text
minimize wall_time_ms under fixed correctness cases
minimize operations * memory
maximize verified accuracy under fixed compute
minimize proof size after independent proof checking
maximize objective value with independent feasibility checks
```

Avoid scores that can be gamed by:

- deleting validation,
- caching known public answers,
- using network access,
- reading hidden files,
- changing the harness,
- changing the score output directly.

## Separate Public And Verifier Checks

Public tests are for fast iteration. They should catch obvious breakage.

Verifier-only checks are for trust. They should catch:

- hardcoded public examples,
- invalid shortcuts,
- stale score files,
- forbidden file access,
- randomness abuse,
- missing work,
- hidden edge cases.

Use `commands.verify` for verifier-only checks:

```json
{
  "commands": {
    "test": "node harness/test.js",
    "verify": "node harness/verify.js",
    "score": "node harness/score.js"
  }
}
```

## Define Editable And Forbidden Paths

Keep the solver surface narrow:

```json
{
  "editablePaths": ["starter/solution.js"],
  "forbiddenPaths": ["harness/**", "challenge.json", "score.json"]
}
```

Editable paths are packaged into submission bundles. Forbidden paths are not
packaged and should not be changed by solvers.

Use directory globs only when necessary:

```json
{
  "editablePaths": ["src/solver/**"]
}
```

## Build The Challenge

Generate a starter pack:

```bash
node ./packages/core/src/cli.js create rckarena --name "RCK Arena"
```

Then edit:

```text
challenges/rckarena/challenge.json
challenges/rckarena/starter/
challenges/rckarena/harness/
challenges/rckarena/README.md
challenges/rckarena/SKILL.md
```

Run the preflight:

```bash
node ./challenges/rckarena/bin/rckarena.js doctor --run
```

## Add Metadata To The Spec

If the challenge will live in a public repository, declare the expected source:

```json
{
  "source": {
    "repository": "https://github.com/owner/rckarena"
  }
}
```

This lets `doctor` reject mismatched git remotes.

## Promotion Rule

Define the public frontier rule before launch:

```text
For minimize challenges:
  promote only trusted results with score < current public best.

For maximize challenges:
  promote only trusted results with score > current public best.

For Pareto challenges:
  promote non-dominated trusted results.
```

Benchforge's hosted API currently supports a simple frontier rule for the
primary score. Pareto or multi-track leaderboards should be modeled explicitly
in the challenge metrics and hosted layer.

## Author Checklist

Before sharing a challenge:

- `doctor --run` passes.
- Public tests are fast.
- Score command deletes stale outputs or overwrites them deterministically.
- `commands.verify` exists when public tests can be overfit.
- `editablePaths` are narrow.
- `forbiddenPaths` include harness and config.
- A baseline run exists.
- A candidate can be submitted and verified.
- `submissions audit` produces a useful review directory.
- Trust language in README says local is not public proof.
- The challenge-specific `SKILL.md` tells agents what they may edit.

