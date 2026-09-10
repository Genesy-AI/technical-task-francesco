export type LeadsVerifyEmailsInput = {
  leadIds: number[]
}

export type LeadsVerifyEmailsOutput = {
  success: boolean
  /** Leads the batch was asked to verify. */
  processed: number
  /** Leads whose email came back deliverable. */
  valid: number
  /** Leads whose email came back undeliverable. */
  invalid: number
  /** Leads whose verification could not be completed at all. */
  failed: number
  results: Array<{
    leadId: number
    emailVerified: boolean
  }>
  errors: Array<{
    leadId: number
    leadName: string
    error: string
  }>
}
