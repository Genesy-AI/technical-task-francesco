# Improvements

Findings worth tracking, written while fixing the email verification hang. Each entry is scoped so
it can be picked up on its own.

## 1. Make long-running enrichment asynchronous

**Priority:** high. **Effort:** medium (1 to 2 days).

`POST /leads/verify-emails` holds the HTTP request open while it awaits every Temporal workflow
through `client.workflow.execute`. That coupling is what turned one slow provider into a browser
spinner that never resolved. The current fix bounds the wait (finite activity retries, a per-lead
workflow ceiling, a 60s batch deadline, an axios timeout), so the request always terminates with a
useful answer. It does not remove the coupling: a large batch of slow leads still runs up against
the deadline and reports leads that are technically still verifying.

The structural fix is to stop making the client wait:

- `POST /leads/verify-emails` starts one workflow per lead and returns `202` with the workflow ids.
- Verification state moves onto the lead itself (`pending` / `valid` / `invalid` / `failed` plus a
  timestamp and a failure reason), instead of being inferred from a nullable boolean. This needs a
  migration.
- The frontend reflects per-lead progress in the table, polling the leads query while any lead is
  pending. No batch-level spinner, no all-or-nothing toast.
- The worker persists the outcome when the workflow finishes, so a browser that navigates away no
  longer loses the result.

This is also what the enrich-phone workflow needs (three sequential providers, retries, user-visible
progress), so the two should share one mechanism rather than growing a second synchronous endpoint.
Worth doing before any further enrichment action is added.

## 2. Distinguish "not verified yet" from "verification failed"

**Priority:** medium. **Effort:** small, but needs a migration.

`lead.emailVerified` is a nullable boolean, so `null` has to mean both "never checked" and "we
tried and could not tell". The leads table renders that as `❓`, which reads as "unknown" in both
cases. A lead whose verification failed is actionable and should not look identical to one nobody
has touched. Folding this into the status column from item 1 solves both at once.

## 3. The task queue name is duplicated as a literal

**Priority:** low. **Effort:** trivial.

`'myQueue'` is written independently in `backend/src/worker.ts` and
`backend/src/services/emailVerification.ts`. These two must agree or work is silently queued to a
queue nobody polls, which surfaces as a workflow that sits in `Running` forever: the exact symptom
we just spent time diagnosing. It should be one exported constant, with a name that says what the
queue is for. Same for the Temporal address, currently hardcoded in both files.

## 4. CORS is open to every origin

**Priority:** medium. **Effort:** trivial.

`backend/src/index.ts` sets `Access-Control-Allow-Origin: *` by hand on every response. It should be
an explicit allowlist driven by configuration, per environment. Related: the hand-rolled middleware
also answers every `OPTIONS` request with a `200` regardless of the route, so preflight succeeds for
endpoints that do not exist.

## 5. The API server and the Temporal worker share a process

**Priority:** medium. **Effort:** small.

`backend/src/index.ts` calls `runTemporalWorker()` after `app.listen`, so the worker's activities
compete with request handling and a worker crash takes the API down with it. They should be separate
entry points, deployable and restartable on their own. The `pnpm dev` script and the README's run
instructions need updating with it.

## 6. No test coverage for Temporal workflows

**Priority:** medium. **Effort:** small.

The batch and error-handling logic around verification is unit tested
(`backend/src/services/emailVerification.test.ts`), but the workflow's own timeout and retry
configuration is not, and that configuration was the actual bug. `@temporalio/testing` provides a
time-skipping test environment that would assert it directly, in milliseconds rather than real time.
It is a new dependency, so it needs a decision before being added.

## 7. Routes and validation live in one file

**Priority:** low. **Effort:** medium.

`backend/src/index.ts` is approaching 300 lines and holds every route, its request validation and
its persistence, with the same `if (!req.body || typeof req.body !== 'object')` block copy-pasted
across handlers. Verification now sits behind a service, and the remaining routes should follow, with
the repeated shape checks replaced by one schema-based validator at the trust boundary.
