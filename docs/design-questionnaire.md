# Design Questionnaire

Use this questionnaire before creating a Benchforge challenge. It is written for
both humans and agents. Answer only the questions that affect the benchmark
contract; skip the rest when the answer is obvious.

## 1. Problem Shape

What is the challenge trying to improve?

```text
algorithm speed
algorithm memory
model quality
model efficiency
mathematical construction
proof/certificate size
cryptographic circuit cost
systems throughput
compiler output
search/planning performance
```

What should solvers submit?

```text
code
patch
config
model weights
training script
proof
witness
circuit
dataset transform
binary
log
```

Is the submitted artifact small enough for a `benchforge.submission.v1` bundle?

- Yes: include it under `editablePaths`.
- No: bundle a manifest with hashes and store the large artifact elsewhere.

## 2. Correctness

What makes a solution valid before score matters?

Examples:

```text
passes all semantic tests
produces a proof that verifies
matches reference output
satisfies constraints exactly
does not exceed resource budget
keeps accuracy above threshold
does not use forbidden data
```

Can correctness be checked independently of solver code?

- If yes, prefer a trusted checker that consumes output/certificates.
- If no, run solver code in a clean, restricted verifier environment.

## 3. Score

What is the primary score?

```text
time_ms
memory_mb
operations
objective_value
loss
accuracy
proof_size
cost_product
tokens
energy_estimate
```

Direction:

```text
minimize
maximize
```

What secondary metrics help explain submissions?

Examples:

```text
correctness_cases
checksum
wall_time_ms
cpu_time_ms
peak_memory_mb
model_params
dataset_hash
seed
hardware
```

Can a solver improve the score by deleting required work?

If yes, the correctness check is not strong enough.

## 4. Public Versus Hidden Checks

What should be public?

```text
small examples
smoke tests
schema checks
fast deterministic cases
baseline scoring command
```

What must be verifier-only?

```text
hidden seeds
private dataset split
larger input distribution
adversarial edge cases
resource limits
proof validation corpus
leakage checks
```

Does the challenge need `commands.verify`?

- Use it when public tests can be hardcoded or overfit.
- Skip it only when public scoring is already a complete trust boundary.

## 5. Environment

Where should trusted verification run?

```text
GitHub Actions Ubuntu runner
fixed CPU machine
fixed GPU machine
macOS Metal machine
browser environment
container sandbox
multiple replicated environments
```

Which versions matter?

```text
OS
compiler
runtime
Node/Python/Rust/CUDA/MLX versions
CPU/GPU model
dataset version
random seed policy
```

Does the score depend on noisy timing?

- If yes, define repetitions, warmup, aggregation, and runner hardware.

## 6. Editable Surface

What files may solvers edit?

```json
{
  "editablePaths": ["starter/solution.js"]
}
```

What files must be forbidden?

```json
{
  "forbiddenPaths": ["harness/**", "challenge.json", "score.json"]
}
```

Could a solver change the score output directly?

- If yes, forbid that path and make the scorer overwrite it.

## 7. Public Operation

How will submissions become public?

```text
local bundle only
GitHub branch with audit directory
GitHub Actions verifier
Cloudflare hosted leaderboard
manual review
multiple verifier replicas
```

Should GitHub be an audit trail?

- Good for provenance and code review.
- Not ideal as the only query database for many submissions.

Should Cloudflare/D1 be used?

- Good for leaderboard reads, notes, search, and telemetry.
- Should store trusted metadata, not untrusted local scores.

## 8. Agent Instructions

What should an agent know before optimizing?

```text
allowed editable paths
forbidden paths
baseline commands
score direction
known failed approaches
hidden trust boundary
metadata to include on submit
update safety guard
```

Add or update the challenge-specific `SKILL.md` with those details.

## 9. Final Contract

End design with this block:

```text
Challenge:
CLI:
Artifact:
Bundle contents:
Editable paths:
Forbidden paths:
Score:
Public checks:
Verifier checks:
Verifier command:
Trusted verifier environment:
Cheat risks:
Promotion rule:
Hosted mode:
First implementation step:
```

