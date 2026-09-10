import { Client, Connection } from '@temporalio/client'
import { verifyEmailWorkflow } from '../workflows'

const TEMPORAL_ADDRESS = 'localhost:7233'
const TEMPORAL_NAMESPACE = 'default'
const TASK_QUEUE = 'myQueue'
const CONNECT_TIMEOUT = '5 seconds'

/**
 * Hard ceiling for a single lead. The slowest provider takes ~20s and the activity retries up to
 * 3 times, so 2 minutes leaves room for a genuine retry while guaranteeing the workflow always
 * terminates instead of retrying forever.
 */
const WORKFLOW_EXECUTION_TIMEOUT = '2 minutes'

/**
 * Leads are verified in parallel so one slow lead cannot block the rest of the batch. Capped at 5
 * because the providers have no published rate limit yet: raise it once we know the real one.
 */
const MAX_CONCURRENT_VERIFICATIONS = 5

/**
 * Ceiling for the whole batch. A large batch of slow leads would otherwise outlive the caller's
 * patience, so leads still running when it expires are reported as failures and the request
 * answers. Re-running picks up the same workflow, see `verifyEmailWithTemporal`.
 */
const DEFAULT_BATCH_DEADLINE_MS = 60_000

export type VerifiableLead = {
  id: number
  firstName: string
  lastName: string | null
  email: string
}

export type EmailVerificationSummary = {
  /** Leads the batch was asked to verify. */
  processed: number
  /** Leads whose email came back deliverable. */
  valid: number
  /** Leads whose email came back undeliverable. */
  invalid: number
  /** Leads whose verification could not be completed at all. */
  failed: number
  results: Array<{ leadId: number; emailVerified: boolean }>
  errors: Array<{ leadId: number; leadName: string; error: string }>
}

/** Verifies one email and resolves to whether it is deliverable. */
export type VerifyEmail = (lead: VerifiableLead) => Promise<boolean>

/** Stores one verification outcome. */
export type PersistVerification = (leadId: number, emailVerified: boolean) => Promise<void>

export type VerifyLeadEmailsDeps = {
  verifyEmail: VerifyEmail
  persist: PersistVerification
  /** Overridable so tests do not have to wait out the real deadline. */
  deadlineMs?: number
}

export async function verifyLeadEmails(
  leads: VerifiableLead[],
  deps: VerifyLeadEmailsDeps
): Promise<EmailVerificationSummary> {
  const results: EmailVerificationSummary['results'] = []
  const errors: EmailVerificationSummary['errors'] = []
  const deadline = Date.now() + (deps.deadlineMs ?? DEFAULT_BATCH_DEADLINE_MS)

  await forEachWithConcurrency(leads, MAX_CONCURRENT_VERIFICATIONS, async (lead) => {
    try {
      const emailVerified = await withDeadline(
        deps.verifyEmail(lead),
        deadline - Date.now(),
        'Verification is still running and did not finish in time. Run it again to pick up the result.'
      )
      // A lead whose result cannot be stored is a failure, not a verified lead: if this throws we
      // fall through to the catch below rather than reporting an outcome we did not persist.
      await deps.persist(lead.id, emailVerified)
      results.push({ leadId: lead.id, emailVerified })
    } catch (error) {
      errors.push({
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName ?? ''}`.trim(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Concurrency makes the completion order arbitrary, so sort for a stable response.
  results.sort((a, b) => a.leadId - b.leadId)
  errors.sort((a, b) => a.leadId - b.leadId)

  return {
    processed: leads.length,
    valid: results.filter((result) => result.emailVerified).length,
    invalid: results.filter((result) => !result.emailVerified).length,
    failed: errors.length,
    results,
    errors,
  }
}

export const verifyEmailWithTemporal: VerifyEmail = async (lead) => {
  const client = await getTemporalClient()

  return client.workflow.execute(verifyEmailWorkflow, {
    taskQueue: TASK_QUEUE,
    // One workflow id per lead, so a second click attaches to the run already in flight instead
    // of stacking a duplicate one behind it.
    workflowId: `verify-email-${lead.id}`,
    workflowIdConflictPolicy: 'USE_EXISTING',
    workflowExecutionTimeout: WORKFLOW_EXECUTION_TIMEOUT,
    args: [lead.email],
  })
}

let clientPromise: Promise<Client> | null = null

/** One connection for the process, instead of one per request. */
async function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Connection.connect({
      address: TEMPORAL_ADDRESS,
      connectTimeout: CONNECT_TIMEOUT,
    }).then((connection) => new Client({ connection, namespace: TEMPORAL_NAMESPACE }))

    // A failed connect must not be cached, otherwise every later request reuses the rejection.
    clientPromise.catch(() => {
      clientPromise = null
    })
  }

  return clientPromise
}

async function forEachWithConcurrency<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      await run(items[nextIndex++])
    }
  })

  await Promise.all(workers)
}

/** Rejects if `promise` has not settled within `ms`. The abandoned promise settles on its own. */
function withDeadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  if (ms <= 0) return Promise.reject(new Error(message))

  // An abandoned rejection must not surface as an unhandled rejection.
  promise.catch(() => {})

  let timer: NodeJS.Timeout
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })

  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer))
}
