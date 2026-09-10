import { describe, it, expect, vi } from 'vitest'
import { verifyLeadEmails, VerifiableLead } from './emailVerification'

const lead = (id: number, email: string): VerifiableLead => ({
  id,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  email,
})

const noopPersist = async () => {}

describe('verifyLeadEmails', () => {
  it('reports valid and invalid emails separately', async () => {
    const leads = [lead(1, 'good@example.com'), lead(2, 'bad@example.com'), lead(3, 'also.good@example.com')]

    const summary = await verifyLeadEmails(leads, {
      verifyEmail: async ({ email }) => !email.startsWith('bad'),
      persist: noopPersist,
    })

    expect(summary).toMatchObject({ processed: 3, valid: 2, invalid: 1, failed: 0 })
    expect(summary.results).toEqual([
      { leadId: 1, emailVerified: true },
      { leadId: 2, emailVerified: false },
      { leadId: 3, emailVerified: true },
    ])
    expect(summary.errors).toEqual([])
  })

  it('persists every outcome, including undeliverable emails', async () => {
    const persist = vi.fn(noopPersist)

    await verifyLeadEmails([lead(1, 'good@example.com'), lead(2, 'bad@example.com')], {
      verifyEmail: async ({ email }) => !email.startsWith('bad'),
      persist,
    })

    expect(persist.mock.calls).toEqual([
      [1, true],
      [2, false],
    ])
  })

  it('reports an empty batch without calling the provider', async () => {
    const verifyEmail = vi.fn(async () => true)

    const summary = await verifyLeadEmails([], { verifyEmail, persist: noopPersist })

    expect(summary).toMatchObject({ processed: 0, valid: 0, invalid: 0, failed: 0 })
    expect(verifyEmail).not.toHaveBeenCalled()
  })

  it('keeps verifying the batch when one lead fails', async () => {
    const leads = [lead(1, 'good@example.com'), lead(2, 'broken@example.com'), lead(3, 'good@example.com')]

    const summary = await verifyLeadEmails(leads, {
      verifyEmail: async ({ email }) => {
        if (email.startsWith('broken')) throw new Error('provider unreachable')
        return true
      },
      persist: noopPersist,
    })

    expect(summary).toMatchObject({ processed: 3, valid: 2, invalid: 0, failed: 1 })
    expect(summary.errors).toEqual([{ leadId: 2, leadName: 'First2 Last2', error: 'provider unreachable' }])
  })

  it('reports a non-Error rejection instead of dropping it', async () => {
    const summary = await verifyLeadEmails([lead(1, 'good@example.com')], {
      verifyEmail: async () => Promise.reject('a string, not an Error'),
      persist: noopPersist,
    })

    expect(summary).toMatchObject({ failed: 1, valid: 0 })
    expect(summary.errors[0].error).toBe('Unknown error')
  })

  it('counts a lead as failed when its result cannot be stored', async () => {
    const summary = await verifyLeadEmails([lead(1, 'good@example.com')], {
      verifyEmail: async () => true,
      persist: async () => {
        throw new Error('database is locked')
      },
    })

    expect(summary).toMatchObject({ processed: 1, valid: 0, invalid: 0, failed: 1 })
    expect(summary.errors[0].error).toBe('database is locked')
  })

  it('gives up on a lead that outlives the batch deadline instead of hanging', async () => {
    const leads = [lead(1, 'good@example.com'), lead(2, 'slow@example.com')]

    const summary = await verifyLeadEmails(leads, {
      deadlineMs: 50,
      verifyEmail: async ({ email }) => {
        if (email.startsWith('slow')) await new Promise((resolve) => setTimeout(resolve, 5_000))
        return true
      },
      persist: noopPersist,
    })

    expect(summary).toMatchObject({ processed: 2, valid: 1, failed: 1 })
    expect(summary.errors[0]).toMatchObject({ leadId: 2 })
    expect(summary.errors[0].error).toMatch(/did not finish in time/)
  })

  it('does not store a result for a lead abandoned at the deadline', async () => {
    const persist = vi.fn(noopPersist)

    await verifyLeadEmails([lead(1, 'slow@example.com')], {
      deadlineMs: 50,
      verifyEmail: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5_000))
        return true
      },
      persist,
    })

    expect(persist).not.toHaveBeenCalled()
  })

  it('verifies in parallel without exceeding the concurrency cap', async () => {
    const leads = Array.from({ length: 12 }, (_, index) => lead(index + 1, `lead${index}@example.com`))
    let inFlight = 0
    let peakInFlight = 0

    const summary = await verifyLeadEmails(leads, {
      verifyEmail: async () => {
        inFlight += 1
        peakInFlight = Math.max(peakInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 10))
        inFlight -= 1
        return true
      },
      persist: noopPersist,
    })

    expect(summary.valid).toBe(12)
    expect(peakInFlight).toBeGreaterThan(1)
    expect(peakInFlight).toBeLessThanOrEqual(5)
  })
})
