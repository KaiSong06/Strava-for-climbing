# ADR 0006: Sentry-native logging across api + vision

- **Status:** Accepted
- **Date:** 2026-04-09
- **Deciders:** Engineering team

## Context

Before Sprint 1 Track C (commit `29db999`, "feat: Sentry-native
structured logging across api + vision + mobile") the API used ad-hoc
`console.log`. Errors went to Sentry via `setupExpressErrorHandler`,
but logs went nowhere — they were lost on container restart and
impossible to correlate with the errors that referenced them. The
Python vision service had the same problem.

The options:

- **pino** / **winston** — fast JSON logging to stdout, then a
  separate forwarder or aggregator to get them into Sentry.
- **Sentry Logs API** — `Sentry.logger.info/warn/error` in the v10
  SDK writes structured log events directly onto the Sentry
  transport. Log events are automatically correlated with the
  active trace, breadcrumbs, and any exception captured on the same
  request.

## Decision

Use Sentry's native logging across both backend services.

**API** (`api/src/lib/sentry.ts`):

```ts
Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  tracesSampleRate: 0.2,
  environment: process.env['NODE_ENV'] ?? 'development',
  enabled: !!process.env['SENTRY_DSN'],
  enableLogs: true,
  integrations: [
    // Any stray console.warn/console.error that slips past lint is
    // automatically promoted to a structured Sentry log event.
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
  ],
});
```

Consumers import a tiny shim:

```ts
// api/src/lib/logger.ts
import { Sentry } from './sentry';
export const logger = Sentry.logger;
```

and call `logger.info('Upload matched', { uploadId, problemId, score })`
with structured attributes, not string interpolation. Secrets, tokens,
and full request bodies are banned from logger payloads; the file
header at `api/src/lib/logger.ts` makes this explicit.

**Vision** (`vision/main.py`):

```python
sentry_sdk.init(
    dsn=_sentry_dsn,
    environment=os.environ.get("ENVIRONMENT", "development"),
    traces_sample_rate=0.2,
    _experiments={"enable_logs": True},
    integrations=[
        FastApiIntegration(),
        LoggingIntegration(),
    ],
)
```

`LoggingIntegration` forwards every stdlib `logging.INFO+` record to
Sentry as a structured log event (and every `logging.ERROR+` as an
exception). Existing `logger.info(...)` calls in the workers get
Sentry forwarding for free — no code change at the call sites.

## Consequences

**Easier**

- Logs, traces, and errors share the same `request_id` automatically.
  When a 500 lands in Sentry we see the preceding `info` log events on
  the same request in the breadcrumb trail, with no glue code.
- One dependency already on board (`@sentry/node` for the API,
  `sentry-sdk` for the vision service) covers logging end-to-end. No
  pino or winston to add, no separate log forwarder to run.
- `consoleLoggingIntegration` on the API catches every stray
  `console.warn`/`console.error` that slips past lint, so even
  accidental calls get structured routing.
- Python side: zero call-site changes. Existing logging calls just
  start appearing in Sentry once `LoggingIntegration` is installed.

**Harder**

- Logs go to Sentry, not stdout, when `SENTRY_DSN` is set. For local
  dev you want stdout visibility, so **leave `SENTRY_DSN` unset**
  locally. `Sentry.init` still runs (the API passes `enabled:
  !!process.env['SENTRY_DSN']`) and the Python side skips
  `sentry_sdk.init()` when the DSN is missing — stdlib logging still
  prints to stderr.
- Sentry log volume is billed. We sample traces at 20% and keep log
  attributes small (ids and numeric scores, not raw payloads) to stay
  under the included quota.

## Reversal cost

Low. The `logger` export in `api/src/lib/logger.ts` is a single file
that call sites import. Swapping it for a pino instance would mean
changing one file and updating a handful of tests. The vision side
would simply stop registering `LoggingIntegration` and stdlib logging
would revert to stdout/stderr.
