# ADR 0003: Repository capability model

## Context

RepoDeck exposes file writes, branch management, issue and pull request mutations, releases, Pages, and workflow operations. Before this decision, authorization was implicit: each route called GitHub and surfaced whatever 401/403 came back, and the UI hid some buttons without server-side enforcement. That is not an authorization model, because UI state is not a trust boundary and because GitHub responses arrive too late to prevent a doomed mutation.

## Decision

Introduce one capability model derived from the GitHub repository permission flags returned to the authenticated viewer.

- `roleFromPermissions` resolves the strongest flag: `admin → admin`, `maintain → maintain`, `push → write`, `triage → triage`, `pull → read`, otherwise `none`.
- `capabilitiesForRole` maps roles to named capabilities (`writeCode`, `mergePullRequest`, `manageIssues`, `manageReleases`, `managePages`, `runWorkflow`, …).
- Unknown or missing permission payloads resolve to `none`, so dangerous mutations are denied by default.
- Archived repositories deny every mutation while keeping reads.
- Every mutation service calls `requireCapability(repository, capability)` immediately after `assertAccessible`, reusing the same GitHub detail response and adding no extra API calls.
- Upstream 401/403 handling remains in place because permissions can change between the capability check and the mutation.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Trust UI disabled states | UI state is user-controlled and not a security boundary. |
| Wait for upstream 403 | Wastes an API call, maps errors late, and gives inconsistent UX per endpoint. |
| Store roles in a local database | No persistent store by design; GitHub is the source of truth. |
| Mirror GitHub's full role matrix in UI code | Duplication drifts; a single model is used by both server and UI. |

## Consequences

- Every mutation has one auditable authorization point.
- The UI can hide meaningless actions and disable discoverable ones with an explanation.
- GitHub remains the final authority; capability checks reduce doomed requests but do not replace upstream error mapping.

## Security and operability impact

- Denied mutations produce a stable `CAPABILITY_DENIED` (403) response with the capability name and no upstream body.
- Tests cover the role × capability matrix, read-only writes, triage merges, archives, unknown permissions, and mid-session revocation.

## Status

Accepted.
