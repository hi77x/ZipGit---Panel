# Permissions and capabilities

RepoDeck maps GitHub repository permissions to one explicit capability model. Both the server and the UI read the same model (`src/server/authz/capabilities.ts`); the UI only mirrors it, the server enforces it.

## GitHub role resolution

GitHub returns repository `permissions` flags for the authenticated viewer. RepoDeck resolves the strongest flag in this order:

| Flags present | RepoDeck role |
| --- | --- |
| `admin` | `admin` |
| `maintain` | `maintain` |
| `push` | `write` |
| `triage` | `triage` |
| `pull` | `read` |
| none / unknown / missing payload | `none` |

Unknown or missing permission data is treated as **no access** for dangerous mutations. Archived repositories are read-only: every mutation capability is denied regardless of role.

## Capability matrix

| Capability | Minimum role | Notes and failure behavior |
| --- | --- | --- |
| `readRepository`, `readCode`, `readActions`, `runAudit` | read | Read paths still map upstream 404 to "not found or forbidden". |
| `createIssue`, `commentOnIssue` | read | GitHub allows collaborators with read access to open issues and comment. |
| `manageIssues` | triage | Close, reopen, relabel, edit. Denied server-side with `CAPABILITY_DENIED` (403). |
| `managePullRequests` | triage | Close, reopen, edit metadata. |
| `reviewPullRequest` | read | Comment and review. Approval semantics remain GitHub's. |
| `createPullRequest` | write | Opening a same-repository pull request requires push access. |
| `mergePullRequest` | write | Merge, squash, rebase. Triage cannot merge. |
| `writeCode` | write | File create, edit, delete through the Contents API. |
| `createBranch`, `deleteBranch` | write | Default branch deletion stays blocked in the service layer. |
| `manageReleases` | write | Create, edit, delete releases. |
| `runWorkflow`, `cancelWorkflow` | write | Workflow dispatch, rerun, cancel. |
| `managePages` | maintain | GitHub may still answer 403 on some plans; the upstream status is mapped to `PAGES_PERMISSION_OR_PLAN_REQUIRED`. |
| `manageRepository` | admin | Reserved for repository settings operations. |
| `optionalDeleteImportedRepository` | admin | Only used when `REPODECK_ALLOW_REPOSITORY_CLEANUP=true` and the token can actually delete repositories. |
| `importRepository` | authenticated | Owner verification (user or organization membership) runs before any mutation; GitHub is the final enforcement point. |

The full role × capability expectations are tested in `src/server/authz/capabilities.test.ts`, and service-level negative paths (read-only write, triage merge, mid-session revocation, archived repository) are tested against the fault-injection GitHub server in `src/server/services/capability-enforcement.test.ts`.

## Server enforcement

Every mutation service checks the capability immediately after resolving repository access, before any GitHub mutation:

```ts
const repository = await this.repositories.assertAccessible(owner, repo);
requireCapability(repository, "writeCode");
```

This reuses the repository detail response, so enforcement adds no extra GitHub API calls. Upstream `401`/`403` responses are still mapped, because permissions can change between the check and the mutation.

## OAuth scopes

RepoDeck requests the minimum scopes needed for its feature set:

| Scope | Why |
| --- | --- |
| `read:user`, `user:email` | Identity and profile. |
| `repo` | Repository reads and writes, issues, pull requests, releases, Pages, star state. |
| `workflow` | Workflow dispatch and run mutations. |
| `notifications` | Notification inbox. |

`delete_repo` is **not** requested. Repository cleanup after a failed import is opt-in (`REPODECK_ALLOW_REPOSITORY_CLEANUP=true`) and requires the operator to grant that scope deliberately.

## UI behavior

- Actions that are meaningless are hidden (for example: "New file" does not render when `writeCode` is denied).
- Actions that benefit from discoverability are disabled with an explanation (for example: the merge button).
- The UI never receives permission data it can tamper with; capability checks are recomputed on the server from the live GitHub response for each request.
