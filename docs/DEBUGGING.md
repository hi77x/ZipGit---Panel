# Debugging and correlation

RepoDeck is designed so a failed operation can be diagnosed from telemetry alone, without reproducing it locally and without reading user content.

## Correlation identifiers

| Identifier | Where it appears | Scope |
| --- | --- | --- |
| `requestId` | `X-Request-Id` response header, JSON error payload, every log line, OTel span attribute | One HTTP request |
| `operationId` | Import outcome payload, import log lines, import spans | One import transaction |
| GitHub `x-github-request-id` | GitHub transport log line | One upstream API call |

A user-visible error always carries `requestId`. A failed import additionally carries `operationId` in the response body and in the UI.

## Log schema

Every log line is a single JSON object:

```text
timestamp, level, service, operation, route, method,
requestId, operationId, stage, status, errorCode, errorName,
durationMs, githubEndpointTemplate, githubStatus, githubRequestId,
retryCount, rateLimitRemaining, rateLimitResetAt, externalAbort
```

Redaction is enforced in `src/lib/logger.ts`:

- keys matching token/secret/password/credential/content/archive/body names are dropped entirely;
- values must be primitives; nested objects are dropped;
- strings are truncated to 200 characters.

`LOG_LEVEL=debug|info|warn|error` controls verbosity. Set `LOG_LEVEL=warn` in noisy environments.

## Reproducing an import failure

1. Read the `operationId` from the response.
2. Filter logs by that id. You will see each stage transition: `RECEIVED → PREFLIGHTED → AUTHORIZED → REPOSITORY_CREATED → BLOBS_WRITING → TREE_CREATED → COMMIT_CREATED → REF_PUBLISHED → DEFAULT_BRANCH_CONFIGURED → COMPLETED`, or the failing stage followed by `COMPENSATING`.
3. The `import_failed` event carries `errorCode`, `failedAfterStage`, `retryable`, `repositoryCreated`, and `refPublished`.
4. Cleanup events (`import_ref_deleted`, `import_repository_deleted`, `import_ref_delete_failed`, `import_repository_delete_failed`) show exactly what was compensated.
5. The outcome status (`failed`, `compensated`, `cleanup_incomplete`) plus `cleanup.*` in the response tells you what remains on GitHub.

The logs never include archive content, file names from secrets findings, or credentials.

## Optional OpenTelemetry

Telemetry export is off unless an OTLP endpoint is configured. The always-on behavior is structured logs plus in-process spans/metrics that are no-ops without an SDK.

To enable OTLP export:

```bash
npm install @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=repodeck
```

`src/instrumentation.ts` registers the SDK at startup when the endpoint is set. If the packages are missing, RepoDeck logs a warning and continues without telemetry.

### Spans

`http.request`, `github.request`, `import.execute`, `import.repository.create`, `import.blobs.write`, `import.tree.create`, `import.commit.create`, `import.ref.publish`, `import.default_branch.configure`, `audit.execute`.

### Metrics

| Metric | Type | Attributes |
| --- | --- | --- |
| `repodeck.http.requests` | counter | `method`, `route`, `status` |
| `repodeck.http.request.duration` | histogram | `method`, `route` |
| `repodeck.http.errors` | counter | `route`, `errorCode` |
| `repodeck.github.requests` | counter | `method`, `endpoint`, `status` |
| `repodeck.github.request.duration` | histogram | `method`, `endpoint` |
| `repodeck.github.retries` | counter | `endpoint`, `status` |
| `repodeck.import.outcomes` | counter | `status`, `stage` |
| `repodeck.import.duration` | histogram | — |
| `repodeck.import.files` | histogram | — |
| `repodeck.import.scan_truncated` | counter | — |
| `repodeck.import.cleanup_incomplete` | counter | — |
| `repodeck.audit.runs` / `repodeck.audit.duration` | counter / histogram | `truncated` |
| `repodeck.secret.findings` | counter | `severity`, `source` (counts only) |

Routes and GitHub endpoints are normalized templates, never raw URLs or repository names, to keep cardinality bounded. Secret metrics carry counts and severities only — never values or paths.

## Health endpoints

| Endpoint | Meaning |
| --- | --- |
| `GET /api/health` | Liveness. Process is running. Includes `version` and `commit`. Never checks GitHub, so a GitHub outage cannot restart healthy containers. |
| `GET /api/health/live` | Liveness alias with explicit `status: "alive"`. |
| `GET /api/health/ready` | Readiness. Validates required local configuration. Returns `503` with safe reasons when the environment is invalid. |

## Known non-signals

- Unreferenced Git blobs can remain in GitHub after a failed import. They are invisible and are garbage collected by GitHub; there is no API to delete them.
- `cleanup_incomplete` means a repository shell remains. This is expected without the `delete_repo` scope and is reported deliberately.
