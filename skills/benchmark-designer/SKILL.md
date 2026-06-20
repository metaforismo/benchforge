---
name: benchmark-designer
description: Design verifiable benchmark arenas and Benchforge challenge packs from vague domains or specific research problems. Use when the user asks to create a new benchmark, choose interesting problems in a field, define scoring/anti-cheat rules, design local/hosted verifier workflows, or generate a CLI/leaderboard-ready challenge like ECDSA.fail for ML, math, algorithms, cryptography, systems, or optimization tasks.
---

# Benchmark Designer

Use this skill to turn a domain or problem into a concrete Benchforge challenge.

## Workflow

1. Classify the request:
   - Vague domain: propose 3-5 challenge candidates before choosing one.
   - Specific problem: design the benchmark directly.
   - Existing repo: map editable paths, harness commands, metrics, and verifier tiers.

2. Ask questions only when they change the benchmark contract.
   - For vague domains, ask a short batch of high-value questions.
   - For implementation blockers, ask one question at a time.
   - If the user says "fai tu" or "you decide", choose conservative defaults and state them.

3. Pick a benchmark archetype. Read `references/archetypes.md` when the domain is not obvious.

4. Threat-model cheating. Read `references/anti-cheat-checklist.md` before finalizing scoring or verification.

5. Produce a challenge contract:
   - challenge id and CLI name
   - editable paths
   - forbidden paths
   - public tests
   - hidden/verifier-only checks
   - optional `commands.verify` command for hidden or verifier-only checks
   - primary metric and score direction
   - hardware or compute budget
   - local, accepted, verified, promoted, and replicated tiers

6. Generate or update the challenge:

```bash
node ./packages/core/src/cli.js create <id> --name "<Name>"
node ./challenges/<id>/bin/<id>.js run
node ./challenges/<id>/bin/<id>.js submit
node ./challenges/<id>/bin/<id>.js verify --json --output .benchforge/verifier-result.json
```

7. Update the generated harness and `challenge.json` for the chosen problem.

8. Verify locally and explain the remaining trust gap. Local `accepted` is not public proof.

## Question Style

Use questions to expose benchmark fragility:

- What artifact must solvers submit: code, patch, proof, model weights, config, circuit, dataset transform, or witness?
- What makes a solution correct independent of speed?
- Which metric cannot be improved by deleting work, hardcoding examples, or exploiting test leakage?
- Which tests are public, and which checks must be verifier-only?
- Which environment matters: Linux CPU, macOS, CUDA, Metal, browser, fixed cloud runner, or multiple tracks?
- What is the promotion rule for the public leaderboard?

Use `references/question-bank.md` for deeper brainstorming.

## Output Shape

End design work with:

```text
Challenge:
CLI:
Artifact:
Editable paths:
Forbidden paths:
Score:
Public checks:
Verifier checks:
Verifier command:
Cheat risks:
Promotion rule:
First implementation step:
```
