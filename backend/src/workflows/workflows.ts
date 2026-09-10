import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

const { verifyEmail } = proxyActivities<typeof activities>({
  // The slowest provider we have observed answers in ~20s. The previous 1s timeout killed every
  // attempt before it could return, and because no retry policy was set the SDK default applied
  // (unlimited attempts), so the activity retried forever and the workflow never completed.
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
