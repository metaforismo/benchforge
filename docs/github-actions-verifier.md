# GitHub Actions Verifier

Benchforge includes a manual GitHub Actions verifier for public or semi-public
challenge workflows that do not need a hosted queue yet.

The workflow lives at:

```text
.github/workflows/verify-bundle.yml
```

It does not trust local scores. It imports a `benchforge.submission.v1` bundle,
replays it in CI, writes a trusted `benchforge.verification.v1` result, and
uploads verifier artifacts.

## Local Solver Flow

Create a local candidate:

```bash
node ./challenges/toyfail/bin/toyfail.js submit \
  --verify \
  --bundle-output .benchforge/latest.bundle.json \
  --output .benchforge/verifier-result.json
```

Export a reviewable artifact directory:

```bash
node ./challenges/toyfail/bin/toyfail.js submissions audit latest \
  --output .benchforge/audit-latest
```

The neutral artifact is:

```text
.benchforge/latest.bundle.json
```

The audit directory is useful for a branch, pull request, issue attachment, or
manual review:

```text
.benchforge/audit-latest/
```

## Trusted Verifier Flow

Push or otherwise make the bundle available in the repository branch you want to
verify. For a GitHub-native audit trail, use a branch name like:

```text
submissions/<submission-id>
```

The simplest branch shape is to put the audit directory contents at the branch
root:

```text
README.md
submission.bundle.json
submission.json
files/
```

Then run the **Verify Bundle** workflow manually with:

```text
challenge_path = challenges/toyfail
submission_ref = submissions/<submission-id>
bundle_path    = submission.bundle.json
promote        = true or false
publish_hosted = false unless Cloudflare secrets are configured
```

The workflow:

1. checks out trusted verifier code from the repository default branch,
2. checks out the submitted bundle from `submission_ref` or the dispatch ref,
3. runs `doctor --run`,
4. verifies the bundle with `--trusted --verifier-kind github-actions`,
5. applies `--promote` when requested,
6. records the submitted commit URL in verifier metadata,
7. uploads `benchforge-verifier-result`,
8. uploads `benchforge-submission-audit`,
9. optionally publishes to the hosted Cloudflare API in a separate fresh job.

The split checkout is intentional: untrusted submission branches provide the
bundle, but the verifier code and publish code come from the default branch.
The hosted publish step runs in a separate job so API secrets are not exposed in
the same runner that executed submitted code.

## Hosted Publishing

To publish the trusted result to Cloudflare, set repository secrets:

```text
BENCHFORGE_API_URL=https://your-worker.workers.dev
BENCHFORGE_API_TOKEN=<runner token>
```

Then set `publish_hosted=true` when dispatching the workflow.

Keep these secrets only in owner-controlled repositories/runners. Do not expose
them to public solver machines. The hosted API treats this token as authority to
publish trusted verifier results.

## Trust Notes

- `accepted` means a local or untrusted verifier replayed the submission.
- `verified` means a trusted runner reproduced it.
- `promoted` means a trusted runner reproduced it and requested main-frontier
  promotion.
- The hosted API may demote a non-frontier `promoted` request to `verified`.

This matches the useful part of the ECDSA.fail pattern: public artifacts and
auditable verifier runs, while keeping heavy benchmark execution out of the
website/API.

The static report and hosted leaderboard can display the commit link, solver,
model, and note when those fields are present. They are metadata for review and
provenance; the trusted score still comes only from the replayed verifier run.
