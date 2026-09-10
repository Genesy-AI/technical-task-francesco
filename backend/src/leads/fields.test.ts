import { describe, it, expect } from 'vitest'
import { LEAD_FIELDS, LEAD_FIELDS_BY_KEY, LeadFieldKey } from './fields'

const parse = (key: LeadFieldKey, raw: string) => {
  const field = LEAD_FIELDS_BY_KEY.get(key)
  if (!field) throw new Error(`No field registered for ${key}`)
  return field.parse(raw)
}

describe('lead field registry', () => {
  it('registers every field under its own key', () => {
    expect(LEAD_FIELDS.map((field) => field.key).sort()).toEqual([...LEAD_FIELDS_BY_KEY.keys()].sort())
  })
})

describe('required text fields', () => {
  it('trims and accepts a value', () => {
    expect(parse('firstName', '  John  ')).toEqual({ value: 'John' })
  })

  it('rejects blank input with the field name', () => {
    expect(parse('firstName', '   ')).toEqual({ value: null, error: 'First name is required' })
    expect(parse('lastName', '')).toEqual({ value: null, error: 'Last name is required' })
  })
})

describe('email', () => {
  it('accepts a well formed address', () => {
    expect(parse('email', 'john.doe@example.com')).toEqual({ value: 'john.doe@example.com' })
  })

  it('rejects a blank address as missing, not malformed', () => {
    expect(parse('email', '')).toEqual({ value: null, error: 'Email is required' })
  })

  it('rejects a malformed address', () => {
    expect(parse('email', 'john.doe@example')).toEqual({ value: null, error: 'Invalid email format' })
  })
})

describe('optional text fields', () => {
  it('turns a blank value into null rather than an empty string', () => {
    expect(parse('jobTitle', '  ')).toEqual({ value: null })
    expect(parse('companyName', '')).toEqual({ value: null })
  })
})

describe('phoneNumber', () => {
  // Every shape below is taken from the sample files in docs/.
  it.each([
    '+1-280-754-0462x2154',
    '001-464-312-8555',
    '(760)551-9973x6454',
    '005-190-0118',
    '7549075690',
    '+34 611 22 33 44',
  ])('accepts %s as typed', (raw) => {
    expect(parse('phoneNumber', raw)).toEqual({ value: raw })
  })

  it('treats a blank value as absent, not as an error', () => {
    expect(parse('phoneNumber', '')).toEqual({ value: null })
  })

  it('rejects a value with letters in it', () => {
    expect(parse('phoneNumber', '+1 555 CALL NOW')).toEqual({
      value: null,
      error: '"+1 555 CALL NOW" is not a usable phone number',
    })
  })

  it('rejects a number with too few digits to dial', () => {
    expect(parse('phoneNumber', '12345').error).toBeDefined()
  })

  it('rejects a number longer than any real one', () => {
    expect(parse('phoneNumber', '1'.repeat(21)).error).toBeDefined()
  })
})

describe('yearsAtCompany', () => {
  it('returns a number, not the raw string', () => {
    expect(parse('yearsAtCompany', '3')).toEqual({ value: 3 })
    expect(parse('yearsAtCompany', '0')).toEqual({ value: 0 })
    expect(parse('yearsAtCompany', '70')).toEqual({ value: 70 })
  })

  it('treats a blank value as absent, not as an error', () => {
    expect(parse('yearsAtCompany', '')).toEqual({ value: null })
  })

  it.each(['three', '4.5', '-1', '2 years'])('rejects %s', (raw) => {
    expect(parse('yearsAtCompany', raw)).toEqual({
      value: null,
      error: `"${raw}" is not a whole number of years`,
    })
  })

  it('rejects a value out of range', () => {
    expect(parse('yearsAtCompany', '80')).toEqual({
      value: null,
      error: '80 years at company is out of range (0 to 70)',
    })
  })
})

describe('linkedinUrl', () => {
  const canonical = 'https://www.linkedin.com/in/john-roe'

  it.each([
    'https://www.linkedin.com/in/john-roe',
    'http://www.linkedin.com/in/john-roe',
    'https://linkedin.com/in/john-roe',
    'linkedin.com/in/john-roe',
    'www.linkedin.com/in/john-roe',
    'https://es.linkedin.com/in/john-roe',
    'https://www.linkedin.com/in/john-roe/',
    'https://www.linkedin.com/in/john-roe?originalSubdomain=es',
    'in/john-roe',
  ])('normalises %s to one canonical form', (raw) => {
    expect(parse('linkedinUrl', raw)).toEqual({ value: canonical })
  })

  it('treats a blank value as absent, not as an error', () => {
    expect(parse('linkedinUrl', '')).toEqual({ value: null })
  })

  it.each([
    'https://www.facebook.com/john-roe',
    'https://www.linkedin.com/company/acme',
    'john-roe',
    'not a url at all',
  ])('rejects %s', (raw) => {
    expect(parse('linkedinUrl', raw)).toEqual({
      value: null,
      error: `"${raw}" is not a linkedin.com/in/ profile URL`,
    })
  })
})
