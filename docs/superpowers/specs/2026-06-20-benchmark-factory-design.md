# Benchmark Factory Design

Date: 2026-06-20
Status: Draft

## Objective

Build a reusable benchmark-challenge factory inspired by ECDSA.fail.

Each challenge should feel like its own public project with a branded CLI, website, leaderboard, notes, and agent-friendly workflow. Under the hood, challenges share a generic engine for running local benchmarks, collecting notes, submitting candidate improvements, verifying submissions, and promoting trusted leaderboard entries.

The system must work in two modes:

1. Local-first: a user can run everything on their own machine without hosting.
2. Hosted/community: the same challenge can be published online so other people and agents can contribute.

## Core Principle

Local benchmark results are useful for iteration but not publicly trusted.

Public trust comes from independent verification:

- The submitter sends a patch, artifact, or source reference.
- A verifier rebuilds from a clean baseline.
- The verifier runs public and hidden checks.
- The verifier signs a result receipt.
- Only verified/promoted results enter the main leaderboard.

This does not make cheating impossible in an absolute sense, but it makes public cheating materially harder and easier to detect.

## Product Shape

The visible user experience is challenge-specific:

```bash
rckfail run
rckfail submit
rckfail notes search
rckfail leaderboard
```

Another challenge gets another name:

```bash
grpoarena run
grpoarena submit
grpoarena notes add
grpoarena verify
```

Internally, these CLIs are generated from one common engine.

```text
Benchmark Factory Core
  auth
  local store
  run orchestration
  scoring
  notes
  submission packaging
  verification receipts
  leaderboard API
  hosted adapters

Challenge Layer
  name
  scoring direction
  editable paths
  harness commands
  public tests
  hidden verifier tests
  website copy
  generated CLI alias
  generated agent skill
```

## Recommended First Prototype

Start with a small, clean algorithmic challenge rather than RCKangaroo-MT directly.

Reason:

- It validates the factory itself.
- It keeps CLI, local store, notes, submission, leaderboard, and verifier design clear.
- It avoids early complexity from CUDA, Metal, and machine-specific performance.
- It gives us a reusable public demo repo quickly.

After that, add RCKangaroo-MT as the first serious adapter.

Suggested phases:

1. Toy but real challenge: optimize a deterministic algorithm with correctness tests and a speed score.
2. RCKangaroo-MT CPU/macOS correctness + benchmark pack.
3. RCKangaroo-MT Mac/Metal verifier.
4. Optional CUDA/GPU verifier.

## Challenge Pack Format

Each challenge is a directory or repository with:

```text
challenge.yaml
README.md
SKILL.md
harness/
public_tests/
examples/
starter/
site/
```

Optional hosted-only/verifier-only files:

```text
verifier/
hidden_tests/
secrets.example.env
github-actions/
```

Example `challenge.yaml` shape:

```yaml
id: rckfail
name: RCKangaroo MT Challenge
cli: rckfail
version: 0.1.0
score:
  direction: minimize
  primary_metric: time_ms
  secondary_metrics:
    - correctness_cases
    - memory_mb
editable_paths:
  - src/solver/**
forbidden_paths:
  - harness/**
  - public_tests/**
commands:
  setup: ./harness/setup.sh
  test: ./harness/test.sh
  score: ./harness/score.sh
submission:
  type: git_patch
verification:
  public: true
  hidden: true
  tiers:
    - local
    - github_actions
    - trusted_runner
```

## CLI Commands

Minimum useful CLI:

```bash
<cli> init
<cli> run
<cli> score
<cli> submit
<cli> leaderboard
<cli> notes add
<cli> notes search
<cli> notes list
<cli> verify
<cli> config
```

Later:

```bash
<cli> update
<cli> install-skill
<cli> doctor
<cli> replay
<cli> promote
<cli> export-site
```

## Local Mode

Local mode should not require login or hosting.

It stores:

```text
.benchmark/
  runs.jsonl
  notes.jsonl
  artifacts/
  receipts/
  config.json
```

Local mode supports:

- Repeated agent iteration.
- Local best score.
- Notes and failure memory.
- Exportable run artifacts.
- Static local leaderboard.
- Optional local HTML report.

Local mode does not claim public trust.

## Hosted Mode

Recommended hosted stack:

- Cloudflare Pages for the website.
- Cloudflare Workers for the API.
- Cloudflare D1 for submissions, users, notes, leaderboard rows.
- Cloudflare R2 for patches, artifacts, logs, and receipts.
- Cloudflare Queues or Workflows for verification job orchestration.
- External trusted runners for heavy compute.
- GitHub Actions for cheap Linux/CPU verification where possible.

Hosted mode adds:

- GitHub login.
- API tokens for agents.
- Shared notes.
- Anonymous optional telemetry.
- Candidate submissions.
- Verified/promoted leaderboard.
- Public challenge website.

## Verification Tiers

```text
local
  Created by submitter machine.
  Useful for iteration.
  Not trusted for public leaderboard.

accepted
  Submission format is valid.
  Basic checks passed.
  Not necessarily independently reproduced.

verified
  Reproduced by one trusted verifier.
  Eligible for leaderboard.

promoted
  Improves public frontier or is manually/automatically selected.
  Appears in main leaderboard and charts.

replicated
  Reproduced by multiple verifier environments.
  Highest confidence.
```

## Anti-Cheat Model

Threats:

- User edits harness.
- User submits fake score.
- User overfits public tests.
- User relies on machine-specific timing noise.
- User submits malicious code.
- User manipulates notes or telemetry.

Controls:

- Only allowed edit paths are packaged.
- Harness is hashed.
- Clean checkout verification.
- Patch-based or source-reference submissions.
- Hidden verifier tests.
- Deterministic seeds derived after submission.
- Score receipts signed by verifier.
- Environment fingerprint recorded.
- Sandboxed verification for untrusted code.
- Main leaderboard only uses verified/promoted entries.
- Notes are marked advisory and never trusted as evidence.

For performance challenges:

- Use multiple runs.
- Use median or best-of-N depending on domain.
- Pin benchmark version.
- Record hardware class.
- Keep separate leaderboards per hardware class when needed.

For math/proof challenges:

- Require machine-checkable proof, witness, or verifier program.
- Use randomized property checks when complete proof is not practical.
- Treat human-readable explanations as notes, not validation.

For ML challenges:

- Use fixed compute budgets.
- Hidden validation sets.
- Reproducible training recipes.
- Seed disclosure rules.
- Separate tracks for architecture/search/training-only changes.

## Notes System

Notes exist both locally and hosted.

Fields:

- note id
- challenge id
- author or anonymous id
- model/tool
- tags
- linked submission id
- status: idea, failure, result, warning, approach
- text
- created timestamp

CLI:

```bash
<cli> notes add --tag failure --tag verifier
<cli> notes search "overflow"
<cli> notes list --tag approach
<cli> config --notes-lookup disabled
```

Agents should be able to read notes, but users can disable shared lookup.

## Agent Skill

Each challenge should generate a small `SKILL.md` that tells an agent:

- What the challenge is.
- What files may be edited.
- What files are forbidden.
- How to run local tests.
- How to score.
- How to submit.
- How to search/add notes.
- What counts as improvement.
- How to avoid wasting time on invalid strategies.

The skill should be challenge-specific but generated from the common factory.

## Public Repository Plan

Create a public GitHub repository in English after the first usable prototype.

Recommended repo name:

```text
benchmark-factory
```

Alternative names:

```text
benchforge
open-benchmark-arena
agent-benchmark-factory
```

Repository contents:

```text
README.md
docs/
packages/core/
packages/cli/
packages/site/
packages/cloudflare/
examples/toy-challenge/
examples/rckfail/
skills/
```

The README should explain:

- What the project does.
- Why local benchmark results are not enough.
- How verified/promoted leaderboards work.
- How to create a new challenge.
- How agents use the CLI and skill.
- How to run fully locally.
- How to deploy hosted mode.

## Design Recommendation

Build the factory in this order:

1. Generic challenge spec.
2. Local CLI.
3. Toy challenge.
4. Local notes and run history.
5. Local static leaderboard export.
6. GitHub Actions verifier path.
7. Cloudflare hosted leaderboard.
8. Generated challenge skill.
9. RCKangaroo-MT adapter.
10. Public GitHub repo and English documentation.

This gives a small but complete loop before touching expensive or machine-specific verification.

## Open Decisions

1. Final public project name.
2. Implementation language for the core CLI.
3. Whether the first hosted version uses GitHub auth immediately or starts token-only.
4. Whether the toy challenge is algorithmic speed, mathematical proof/witness, or ML micro-benchmark.
5. Which RCKangaroo-MT track should be first: CPU correctness, macOS/Metal, or CUDA.

## Suggested Defaults

Use these unless changed later:

- Project name: `benchforge`.
- First generated challenge CLI: `toyfail`.
- Core CLI runtime: TypeScript/Bun or Node, because ECDSA.fail uses a simple installable JS CLI pattern and it is agent-friendly.
- Hosted stack: Cloudflare.
- First verifier: GitHub Actions.
- First serious adapter: RCKangaroo-MT CPU/macOS.

## Self-Review Notes

Concerns to watch during implementation:

1. Do not overbuild hosted mode before the local loop is excellent.
2. Keep challenge packs small and explicit; hidden magic will make agents worse.
3. Treat timing benchmarks carefully because hardware noise can dominate small improvements.
4. Avoid calling local results "verified"; the wording matters for trust.
5. Keep the first toy challenge simple enough that the factory is the thing being tested.
6. Make the public README clear that this is not a single benchmark, but a factory for many benchmark arenas.

Recommendation after review:

Proceed with a local-first `benchforge` prototype that generates a branded `toyfail` challenge. Add GitHub Actions verification next, then Cloudflare hosted leaderboard, then RCKangaroo-MT.
