# ADR 0004: Observability strategy

## Context

RepoDeck runs self-hosted, often without an observability backend. It needs enough telemetry to answer "what happened to this request/import?" without forcing every operator to run a collector, and without leaking repository content or credentials into third-party systems.

The previous state was console JSON logs with requestId and GitHub request metadata. That was useful but not a documented schema, had no metrics, and did not distinguish liveness from readiness.

## Decision

1. **Structured logs are the mandatory baseline.** The schema is documented in `docs/DEBUGGING.md`, redaction is enforced centrally (`src/lib/logger.ts`), string values are truncated, and nested payloads are dropped.
2. **OpenTelemetry is the optional, vendor-neutral trace/metric layer.** `@opentelemetry/api` is a runtime dependency; without a registered provider every span and metric is a no-op. `src/instrumentation.ts` registers a `NodeSDK` with an OTLP trace exporter only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
3. **Operation identity is explicit.** Imports get a stable `operationId` that appears in the API response, every stage log, and spans. Requests keep `requestId` end to end.
4. **Metrics stay low-cardinality and content-free.** Routes are normalized to buckets, GitHub labels use endpoint templates, and secret metrics count severities only.
5. **Liveness and readiness are separate.** `/api/health` and `/api/health/live` report process liveness and never call GitHub. `/api/health/ready` validates local configuration only, so GitHub downtime cannot cause restart loops.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Mandatory OTel SDK with an embedded collector | Forces infrastructure on every self-hoster; contradicts the product's local-first deployment. |
| Home-grown metrics endpoint with a custom exposition format | Rebuilds a telemetry framework and adds a format every backend must parse. |
| Prometheus client library only | Useful but vendor-specific; OTLP covers traces and metrics with one standard. |
| Vendor SDK (Datadog, New Relic, …) | Lock-in and credentials management are unacceptable as the default. |

## Consequences

- Zero-config local development stays simple: logs only.
- Operators who want traces install two packages and set one environment variable; the README and `docs/DEBUGGING.md` document this.
- Spans and metrics are attributed to stable identifiers and never to secrets, repository content, or file paths from findings.
- If the SDK is configured but not installed, startup logs a warning and continues; telemetry is best-effort, not a dependency of serving traffic.

## Status

Accepted.
