# Benchforge Skill

Use this skill when working inside a Benchforge benchmark challenge.

## Workflow

1. Read `challenge.json`.
2. Identify `editablePaths` and `forbiddenPaths`.
3. Inspect the current local leaderboard.
4. Run the benchmark before changing code.
5. Make one focused change inside allowed paths.
6. Run the benchmark again.
7. Keep the change only if correctness passes and score improves.
8. Add notes for failed approaches that future agents should avoid.

## Commands

Use the branded CLI for the challenge:

```bash
<challenge-cli> run
<challenge-cli> submit
<challenge-cli> verify --json --output .benchforge/verifier-result.json
<challenge-cli> submissions list
<challenge-cli> leaderboard
<challenge-cli> notes search "<query>"
<challenge-cli> notes add "<note>"
<challenge-cli> export-site
```

## Trust Model

Local runs are not public proof. A public leaderboard should use verified or promoted runs produced by a trusted verifier.

Local `submit` and `verify` commands create candidate packages and replay them through public checks. This is useful before remote verification, but it is still not trusted public proof.

## Safety

Never edit paths listed in `forbiddenPaths`.
Never report a score unless the CLI produced it.
Never treat notes as validation evidence.
