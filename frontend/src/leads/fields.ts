/**
 * Single source of truth for what a lead is made of, client side: CSV headers, table detail
 * panel, and the template field picker all read this list. Adding a field means one entry
 * here and one in backend/src/leads/fields.ts.
 *
 * The `parse` rules are mirrored from the backend registry, because the two packages share no
 * workspace and the import preview has to validate a file before sending it. Keep the two
 * parser blocks identical: this copy is UX, the backend one is what actually decides. Upgrade
 * path once they start drifting, or once fields become user-defined: serve the registry from
 * GET /leads/fields and delete this copy.
 */

export type LeadFieldKey =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'jobTitle'
  | 'companyName'
  | 'countryCode'
  | 'phoneNumber'
  | 'yearsAtCompany'
  | 'linkedinUrl'

/** Every field a lead can carry, typed one by one so callers keep `yearsAtCompany` as a number. */
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

export type LeadFieldGroup = 'Person' | 'Contact' | 'Company'

/** How the value is rendered and linked once stored. */
export type LeadFieldDisplay = 'text' | 'email' | 'tel' | 'url' | 'number'

export interface ParsedFieldValue {
  /** Null when the raw input was blank, and when it was rejected. */
  value: string | number | null
  /** Set when a non-blank input could not be used. The caller decides whether that is fatal. */
  error?: string
}

export interface LeadFieldDefinition {
  key: LeadFieldKey
  label: string
  group: LeadFieldGroup
  display: LeadFieldDisplay
  required: boolean
  /** Extra CSV headers accepted on top of the field name itself. Already normalised. */
  csvAliases: string[]
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
  {
    key: 'firstName',
    label: 'First name',
    group: 'Person',
    display: 'text',
    required: true,
    csvAliases: [],
    parse: requiredText('First name'),
  },
  {
    key: 'lastName',
    label: 'Last name',
    group: 'Person',
    display: 'text',
    required: true,
    csvAliases: [],
    parse: requiredText('Last name'),
  },
  {
    key: 'countryCode',
    label: 'Country',
    group: 'Person',
    display: 'text',
    required: false,
    csvAliases: ['country'],
    parse: optionalText,
  },
  {
    key: 'email',
    label: 'Email',
    group: 'Contact',
    display: 'email',
    required: true,
    csvAliases: ['emailaddress'],
    parse: parseEmail,
  },
  {
    key: 'phoneNumber',
    label: 'Phone',
    group: 'Contact',
    display: 'tel',
    required: false,
    csvAliases: ['phone'],
    parse: parsePhoneNumber,
  },
  {
    key: 'linkedinUrl',
    label: 'LinkedIn',
    group: 'Contact',
    display: 'url',
    required: false,
    csvAliases: ['linkedin', 'linkedinprofile', 'linkedinprofileurl'],
    parse: parseLinkedinUrl,
  },
  {
    key: 'jobTitle',
    label: 'Job title',
    group: 'Company',
    display: 'text',
    required: false,
    csvAliases: ['jobposition'],
    parse: optionalText,
  },
  {
    key: 'companyName',
    label: 'Company',
    group: 'Company',
    display: 'text',
    required: false,
    csvAliases: ['company'],
    parse: optionalText,
  },
  {
    key: 'yearsAtCompany',
    label: 'Years at company',
    group: 'Company',
    display: 'number',
    required: false,
    csvAliases: ['yearsatcompany', 'yearsatcurrentcompany'],
    parse: parseYearsAtCompany,
  },
]

export const LEAD_FIELD_GROUPS: readonly LeadFieldGroup[] = ['Person', 'Contact', 'Company']

const fieldsByKey = new Map<string, LeadFieldDefinition>(LEAD_FIELDS.map((field) => [field.key, field]))

export const findFieldByKey = (key: string): LeadFieldDefinition | undefined => fieldsByKey.get(key)

/** Headers are compared with punctuation and case removed, so `Years at company` finds the field. */
export const normalizeCsvHeader = (header: string): string => header.toLowerCase().replace(/[^a-z]/g, '')

const fieldsByCsvHeader = new Map<string, LeadFieldDefinition>()
for (const field of LEAD_FIELDS) {
  for (const header of [normalizeCsvHeader(field.key), ...field.csvAliases]) {
    fieldsByCsvHeader.set(header, field)
  }
}

export const findFieldByCsvHeader = (header: string): LeadFieldDefinition | undefined =>
  fieldsByCsvHeader.get(normalizeCsvHeader(header))
