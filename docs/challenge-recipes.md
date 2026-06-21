# Challenge Recipes

This page gives reusable benchmark blueprints. Treat them as starting points,
not final specs. A real challenge still needs domain-specific harness code and
verifier checks.

## Existing Algorithm Repository

Use when you already have a repo and want agents to optimize it.

Example domains:

```text
CUDA kernel
Metal kernel
cryptographic search
graph algorithm
SAT solver
parser
database query engine
```

Contract:

```text
Artifact:
  patch to allowed source files

Editable paths:
  src/solver/**
  kernels/**

Forbidden paths:
  benchmarks/**
  tests/**
  challenge.json
  score.json

Public checks:
  correctness tests on small and medium cases

Verifier checks:
  hidden cases, randomized seeds, larger inputs

Score:
  minimize median runtime or operations under fixed correctness

Promotion:
  trusted score improves current best
```

Good score metrics:

```json
{
  "score": 91.2,
  "metrics": {
    "median_ms": 91.2,
    "p95_ms": 95.8,
    "correctness_cases": 512,
    "hardware": "fixed-runner"
  }
}
```

Anti-cheat notes:

- scorer must overwrite stale outputs,
- tests must reject skipped work,
- hidden verifier cases should be outside the public distribution,
- timing should run on a fixed trusted machine when public ranking matters.

## RCKangaroo-Style Optimization

Use for an existing performance-sensitive cryptographic/search repo.

Contract:

```text
Artifact:
  code patch to solver/kernel implementation

Editable paths:
  src/**
  macos/**
  kernels/**

Forbidden paths:
  tests/**
  harness/**
  benchmark scripts
  challenge.json

Public checks:
  deterministic correctness cases, small known walks, invariant checks

Verifier checks:
  hidden seeds, larger walks, reference implementation comparison

Score:
  minimize runtime for fixed workload

Secondary metrics:
  throughput, errors, hardware, compiler flags, checksum
```

Recommended verifier:

```text
GitHub Actions for portable CPU checks.
Owner-controlled macOS/Metal runner for final promoted results if Metal matters.
```

Promotion rule:

```text
Promote only trusted results that improve median runtime and pass all hidden
invariants on the fixed runner.
```

## ML Training Recipe

Use when agents optimize a training method, architecture, or hyperparameters.

Contract:

```text
Artifact:
  training script + config, optionally weights manifest

Editable paths:
  solution/**
  configs/**

Forbidden paths:
  data/**
  verifier_data/**
  harness/**
  challenge.json

Public checks:
  runs on tiny public dataset, validates output schema

Verifier checks:
  private validation split, leakage checks, fixed compute budget

Score:
  maximize validation metric or minimize loss under budget
```

Good score metrics:

```json
{
  "score": 0.8421,
  "metrics": {
    "accuracy": 0.8421,
    "train_seconds": 782,
    "params": 12400000,
    "dataset_hash": "..."
  }
}
```

Anti-cheat notes:

- keep verifier data private,
- fix compute budget and seed policy,
- record dependency versions,
- reject submissions that read forbidden data,
- decide whether external pretrained weights are allowed.

## PPO/GRPO Research Recipe

Use when the target is reinforcement learning or policy optimization research.

Contract:

```text
Artifact:
  algorithm implementation, config, training loop changes

Editable paths:
  algorithms/**
  configs/**

Forbidden paths:
  envs/hidden/**
  eval/**
  challenge.json

Public checks:
  smoke training on tiny environment, deterministic rollout validation

Verifier checks:
  hidden environment seeds, fixed sample budget, repeated evaluation

Score:
  maximize average return under fixed environment steps

Secondary metrics:
  sample count, wall time, variance, policy checksum
```

Promotion rule:

```text
Promote trusted result only if mean score improves and variance stays within
the declared tolerance.
```

Anti-cheat notes:

- do not expose hidden seeds,
- log exact environment version,
- enforce total environment steps,
- evaluate with training disabled,
- reject policies that depend on local state outside the artifact.

## Mathematical Construction Recipe

Use when solvers search for a construction, proof, witness, or certificate.

Contract:

```text
Artifact:
  witness/proof/certificate generator

Editable paths:
  solution/**
  witnesses/**

Forbidden paths:
  verifier/**
  challenge.json

Public checks:
  small witness validation

Verifier checks:
  independent proof checker or certificate verifier

Score:
  minimize proof size, construction cost, or objective value
  maximize construction quality when validity is binary
```

Good score metrics:

```json
{
  "score": 128,
  "metrics": {
    "proof_size": 128,
    "verification_ms": 42,
    "valid": 1
  }
}
```

Anti-cheat notes:

- score only valid certificates,
- verifier should not trust prose explanations,
- public examples should be smaller than verifier cases,
- store exact theorem/property in the challenge README.

## Circuit Or Compiler Optimization Recipe

Use for circuits, generated programs, query plans, or compiler output.

Contract:

```text
Artifact:
  generator code or output representation

Editable paths:
  generator/**
  solutions/**

Forbidden paths:
  evaluator/**
  challenge.json

Public checks:
  output schema, small semantic equivalence checks

Verifier checks:
  independent evaluator on hidden cases

Score:
  minimize cost model after semantic equivalence
```

Cost examples:

```text
gates * wires
operations * memory
latency + penalty * area
query_cost under fixed result equivalence
```

Anti-cheat notes:

- trusted evaluator should parse output, not import untrusted evaluator code,
- output must include enough information for independent replay,
- semantic equivalence comes before score.

## Systems Throughput Recipe

Use for servers, databases, queues, or runtimes.

Contract:

```text
Artifact:
  code patch or config

Editable paths:
  src/**
  config/**

Forbidden paths:
  loadgen/**
  harness/**
  challenge.json

Public checks:
  smoke load test, correctness under small concurrency

Verifier checks:
  fixed load generator, hidden workload, resource limits

Score:
  maximize throughput or minimize latency under correctness and resource budget
```

Good score metrics:

```json
{
  "score": 18420,
  "metrics": {
    "requests_per_second": 18420,
    "p50_ms": 6.2,
    "p99_ms": 31.4,
    "errors": 0,
    "peak_memory_mb": 512
  }
}
```

Anti-cheat notes:

- reject nonzero error rate,
- include latency tail, not only throughput,
- fixed runner matters,
- hidden workload should include edge cases.

## Choosing A Recipe

Use this shortcut:

```text
Can validity be checked from a certificate?
  Use Mathematical Construction.

Is the goal mostly runtime on existing code?
  Use Existing Algorithm Repository.

Is the output a generated representation?
  Use Circuit Or Compiler Optimization.

Does the result depend on training?
  Use ML Training or PPO/GRPO.

Does the result depend heavily on hardware and load?
  Use Systems Throughput.
```

After choosing a recipe, fill out [Design Questionnaire](./design-questionnaire.md)
and then implement the harness.

