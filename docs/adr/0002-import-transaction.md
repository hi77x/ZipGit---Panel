# ADR 0002: Transactional import and rollback semantics

## Context

RepoDeck imports a ZIP archive into a new GitHub repository as one root commit. GitHub's API requires a repository to exist before Git objects can be created, so a repository shell inevitably exists before any content does.

The original implementation reported a vague `IMPORT_PARTIALLY_COMPLETED` error and could leave a published branch behind when a stage after ref creation failed. It also kept uploading queued blobs after the first failure, and it listed `.env` files by name instead of evaluating archive content.

## Decision

Model the import as an explicit state machine with a stable operation id and typed outcomes.

Stages: `RECEIVED → PREFLIGHTED → AUTHORIZED → REPOSITORY_CREATED → BLOBS_WRITING → TREE_CREATED → COMMIT_CREATED → REF_PUBLISHED → DEFAULT_BRANCH_CONFIGURED → COMPLETED`, with `COMPENSATING` as the failure entry point.

Invariants:

1. The visible branch ref is the publication boundary. Blobs, tree, and commit are written first; the ref is created last.
2. Only side effects recorded in the transaction journal may be compensated. A ref is deleted only if this operation created it and its creation was observed.
3. A pre-existing branch or repository is never deleted or moved.
4. Queued blob writes stop after the first failure, and the in-flight requests are aborted.
5. The result is returned as one of `completed`, `rejected`, `failed`, `compensated`, or `cleanup_incomplete`, with a safe message, remediation, and the exact stage that failed.
6. Content atomicity is guaranteed even when the repository shell cannot be removed: `cleanup_incomplete` is reported honestly, never as success.

Repository deletion requires the broad `delete_repo` scope, so it is disabled by default. Operators can opt in with `REPODECK_ALLOW_REPOSITORY_CLEANUP=true`; when deletion fails, the operation still reports `cleanup_incomplete`.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Delete the repository by default | Requires a broad scope that violates least privilege; the roadmap explicitly forbids adding it silently. |
| Publish the ref first and force-push later | GitHub does not offer object staging outside a repository; publishing first maximizes the window for a visible half-import. |
| Roll back with a job queue / persisted saga | RepoDeck has no persistent store by design; the transaction journal lives for the duration of the request. |

## Consequences

- Unreferenced blob objects can remain in GitHub's object store after a failed import. They are invisible, get garbage collected by GitHub, and cannot be deleted through the API.
- A failed import can leave an empty repository shell. This is reported with the exact URL and remediation.
- Fault-injection tests cover failure before creation, at the first blob, mid blobs, tree, commit, ref, default-branch update, dropped connections, rate limits, and cleanup refusals.

## Security and operability impact

- The archive is fully preflighted and content-scanned before any mutation.
- The operation id appears in logs, the API response, and the UI, so one failed import can be correlated end to end.
- No raw archive content or credential value is written to logs or returned to the client.

## Status

Accepted.
