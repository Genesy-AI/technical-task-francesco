/**
 * Single source of truth for what a lead is made of, server side. Adding a field means one
 * entry here plus a Prisma column: CSV import, validation and message templates pick it up
 * from this list instead of from six hardcoded copies of it.
 *
 * The `parse` rules are mirrored in frontend/src/leads/fields.ts, because the two packages
 * share no workspace and the import preview has to validate before anything is sent. Keep
 * the two parser blocks identical. Upgrade path once they start drifting, or once fields
 * become user-defined: serve this registry from GET /leads/fields and delete the copy.
 */

export interface Lead {
  firstName: string
  lastName?: string | null
  email?: string | null
  jobTitle?: string | null
  companyName?: string | null
  countryCode?: string | null
  phoneNumber?: string | null
  yearsAtCompany?: number | null
  linkedinUrl?: string | null
}

export type LeadFieldKey = keyof Lead

export interface ParsedFieldValue {
  /** Null when the raw input was blank, and when it was rejected. */
  value: string | number | null
  /** Set when a non-blank input could not be used. The caller decides whether that is fatal. */
  error?: string
}

export interface LeadFieldDefinition {
  key: LeadFieldKey
  required: boolean
  parse: (raw: string) => ParsedFieldValue
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const requiredText =
  (label: string) =>
  (raw: string): ParsedFieldValue => {
    const value = raw.trim()
    return value ? { value } : { value: null, error: `${label} is required` }
  }

const optionalText = (raw: string): ParsedFieldValue => {
  const value = raw.trim()
  return { value: value || null }
}

const parseEmail = (raw: string): ParsedFieldValue => {
  const value = raw.trim()
  if (!value) return { value: null, error: 'Email is required' }
  if (!isValidEmail(value)) return { value: null, error: 'Invalid email format' }
  return { value }
}

// Numbers are kept as typed, not normalised to E.164: the enrich-phone workflow is what will
// need a canonical form, and it should own that decision together with libphonenumber-js.
const PHONE_SHAPE = /^[\d\s+().-]+(?:\s*(?:x|ext\.?)\s*\d+)?$/i
const MIN_PHONE_DIGITS = 7
const MAX_PHONE_DIGITS = 20

const parsePhoneNumber = (raw: string): ParsedFieldValue => {
  const value = raw.trim()
  if (!value) return { value: null }

  const digits = value.replace(/\D/g, '')
  if (!PHONE_SHAPE.test(value) || digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    return { value: null, error: `"${value}" is not a usable phone number` }
  }

  return { value }
}

const MAX_YEARS_AT_COMPANY = 70

const parseYearsAtCompany = (raw: string): ParsedFieldValue => {
  const value = raw.trim()
  if (!value) return { value: null }

  if (!/^\d{1,3}$/.test(value)) {
    return { value: null, error: `"${value}" is not a whole number of years` }
  }

  const years = Number(value)
  if (years > MAX_YEARS_AT_COMPANY) {
    return { value: null, error: `${years} years at company is out of range (0 to ${MAX_YEARS_AT_COMPANY})` }
  }

  return { value: years }
}

// Accepts what people actually paste: a full profile URL with or without scheme, a country
// subdomain, tracking query params, or the bare `in/slug` path. One stored shape keeps
// templates and future deduplication from having to know about all five.
const LINKEDIN_PROFILE = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/([^/?#\s]+)/i
const LINKEDIN_PATH = /^in\/([^/?#\s]+)/i

const parseLinkedinUrl = (raw: string): ParsedFieldValue => {
  const value = raw.trim()
  if (!value) return { value: null }

  const slug = (value.match(LINKEDIN_PROFILE) ?? value.match(LINKEDIN_PATH))?.[1]
  if (!slug) {
    return { value: null, error: `"${value}" is not a linkedin.com/in/ profile URL` }
  }

  return { value: `https://www.linkedin.com/in/${slug}` }
}

export const LEAD_FIELDS: readonly LeadFieldDefinition[] = [
  { key: 'firstName', required: true, parse: requiredText('First name') },
  { key: 'lastName', required: true, parse: requiredText('Last name') },
  { key: 'email', required: true, parse: parseEmail },
  { key: 'jobTitle', required: false, parse: optionalText },
  { key: 'companyName', required: false, parse: optionalText },
  { key: 'countryCode', required: false, parse: optionalText },
  { key: 'phoneNumber', required: false, parse: parsePhoneNumber },
  { key: 'yearsAtCompany', required: false, parse: parseYearsAtCompany },
  { key: 'linkedinUrl', required: false, parse: parseLinkedinUrl },
]

export const LEAD_FIELDS_BY_KEY: ReadonlyMap<string, LeadFieldDefinition> = new Map(
  LEAD_FIELDS.map((field) => [field.key, field])
)

/** What a client is allowed to write. Read values can be null, written ones are simply absent. */
export type LeadFieldValues = {
  firstName?: string
  lastName?: string
  email?: string
  jobTitle?: string
  companyName?: string
  countryCode?: string
  phoneNumber?: string
  yearsAtCompany?: number
  linkedinUrl?: string
}

export type LeadInput = LeadFieldValues & {
  firstName: string
  lastName: string
  email: string
}

export interface DroppedFieldValue {
  field: LeadFieldKey
  reason: string
}

export type NormalizedLead =
  | { ok: true; lead: LeadInput; dropped: DroppedFieldValue[] }
  | { ok: false; errors: string[]; dropped: DroppedFieldValue[] }

// The registry is keyed by field name while LeadFieldValues types each field on its own, so
// one cast is needed to bridge them. parse() is what guarantees the value matches the type.
const setFieldValue = (values: LeadFieldValues, key: LeadFieldKey, value: string | number): void => {
  ;(values as Record<LeadFieldKey, string | number>)[key] = value
}

const asRawString = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/**
 * Turns an untrusted lead payload into something safe to persist. Required fields that fail
 * make the whole lead unusable; an optional field that fails is dropped and reported, so a
 * typo in one column never costs the caller a good lead, and never passes silently either.
 */
export function normalizeLeadInput(input: unknown): NormalizedLead {
  const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const values: LeadFieldValues = {}
  const errors: string[] = []
  const dropped: DroppedFieldValue[] = []

  for (const field of LEAD_FIELDS) {
    const { value, error } = field.parse(asRawString(raw[field.key]))

    if (error) {
      if (field.required) {
        errors.push(error)
      } else {
        dropped.push({ field: field.key, reason: error })
      }
      continue
    }

    if (value !== null) setFieldValue(values, field.key, value)
  }

  const { firstName, lastName, email } = values
  if (errors.length > 0 || !firstName || !lastName || !email) {
    return { ok: false, errors, dropped }
  }

  return { ok: true, lead: { ...values, firstName, lastName, email }, dropped }
}
