import { describe, it, expect } from 'vitest'
import { generateMessageFromTemplate, renderTemplate, Lead } from './messageGenerator'

describe('generateMessageFromTemplate', () => {
  const fullLead: Lead = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    jobTitle: 'Software Engineer',
    companyName: 'Tech Corp',
    countryCode: 'US',
  }

  const partialLead: Lead = {
    firstName: 'Jane',
    lastName: null,
    email: 'jane@example.com',
    jobTitle: undefined,
    companyName: '',
    countryCode: 'CA',
  }

  const minimalLead: Lead = {
    firstName: 'Bob',
  }

  describe('successful message generation', () => {
    it('should replace single field in template', () => {
      const template = 'Hello {firstName}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello John!')
    })

    it('should replace multiple different fields in template', () => {
      const template = 'Hi {firstName} {lastName}, welcome to {companyName}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hi John Doe, welcome to Tech Corp!')
    })

    it('should replace the same field multiple times', () => {
      const template = 'Hello {firstName}, how are you {firstName}?'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello John, how are you John?')
    })

    it('should handle template with all available fields', () => {
      const template =
        'Name: {firstName} {lastName}, Email: {email}, Job: {jobTitle} at {companyName}, Country: {countryCode}'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe(
        'Name: John Doe, Email: john.doe@example.com, Job: Software Engineer at Tech Corp, Country: US'
      )
    })

    it('should handle template with no field placeholders', () => {
      const template = 'This is a static message with no placeholders.'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('This is a static message with no placeholders.')
    })

    it('should handle empty template', () => {
      const template = ''
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('')
    })

    it('should handle complex message template', () => {
      const template =
        'Dear {firstName},\n\nI hope this message finds you well. I noticed you work at {companyName} as a {jobTitle}. I would love to connect with you.\n\nBest regards!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe(
        'Dear John,\n\nI hope this message finds you well. I noticed you work at Tech Corp as a Software Engineer. I would love to connect with you.\n\nBest regards!'
      )
    })
  })

  describe('error handling for missing fields', () => {
    it('should throw error when field is null', () => {
      const template = 'Hello {firstName} {lastName}!'
      expect(() => generateMessageFromTemplate(template, partialLead)).toThrow(
        'Missing required field: lastName'
      )
    })

    it('should throw error when field is undefined', () => {
      const template = 'Your job title is {jobTitle}'
      expect(() => generateMessageFromTemplate(template, partialLead)).toThrow(
        'Missing required field: jobTitle'
      )
    })

    it('should throw error when field is empty string', () => {
      const template = 'You work at {companyName}'
      expect(() => generateMessageFromTemplate(template, partialLead)).toThrow(
        'Missing required field: companyName'
      )
    })

    it('should throw error when field does not exist on lead', () => {
      const template = 'Hello {firstName}, your last name is {lastName}'
      expect(() => generateMessageFromTemplate(template, minimalLead)).toThrow(
        'Missing required field: lastName'
      )
    })
  })

  describe('handling of unknown and invalid fields', () => {
    it('should throw error for unknown field in template', () => {
      const template = 'Hello {firstName} {unknownField}!'
      expect(() => generateMessageFromTemplate(template, fullLead)).toThrow(
        'Unknown field in template: unknownField'
      )
    })

    it('should ignore invalid field patterns with hyphens', () => {
      const template = 'Hello {first-name}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {first-name}!')
    })

    it('should ignore invalid field patterns with spaces', () => {
      const template = 'Hello {first name}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {first name}!')
    })
  })

  describe('edge cases and malformed templates', () => {
    it('should handle malformed brackets (single opening bracket)', () => {
      const template = 'Hello {firstName'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {firstName')
    })

    it('should handle malformed brackets (single closing bracket)', () => {
      const template = 'Hello firstName}'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello firstName}')
    })

    it('should ignore empty brackets', () => {
      const template = 'Hello {} {firstName}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {} John!')
    })

    it('should handle nested brackets', () => {
      const template = 'Hello {{firstName}}!'
      const result = generateMessageFromTemplate(template, fullLead)
      expect(result).toBe('Hello {John}!')
    })

    it('should handle brackets with numbers', () => {
      const template = 'Hello {firstName123}!'
      expect(() => generateMessageFromTemplate(template, fullLead)).toThrow(
        'Unknown field in template: firstName123'
      )
    })

    it('should handle case sensitivity', () => {
      const template = 'Hello {FirstName}!'
      expect(() => generateMessageFromTemplate(template, fullLead)).toThrow(
        'Unknown field in template: FirstName'
      )
    })
  })

  describe('performance and large templates', () => {
    it('should handle template with many field replacements', () => {
      const template = Array(100).fill('{firstName}').join(' ')
      const result = generateMessageFromTemplate(template, fullLead)
      const expected = Array(100).fill('John').join(' ')
      expect(result).toBe(expected)
    })

    it('should handle very long field values', () => {
      const longLead: Lead = {
        firstName: 'A'.repeat(1000),
        companyName: 'B'.repeat(500),
      }
      const template = 'Name: {firstName}, Company: {companyName}'
      const result = generateMessageFromTemplate(template, longLead)
      expect(result).toBe(`Name: ${'A'.repeat(1000)}, Company: ${'B'.repeat(500)}`)
    })
  })

  describe('special characters and encoding', () => {
    it('should handle special characters in field values', () => {
      const specialLead: Lead = {
        firstName: 'José',
        companyName: 'Café & Co.',
        email: 'josé@café.com',
      }
      const template = 'Hello {firstName} from {companyName}! Email: {email}'
      const result = generateMessageFromTemplate(template, specialLead)
      expect(result).toBe('Hello José from Café & Co.! Email: josé@café.com')
    })

    it('should handle emojis in field values', () => {
      const emojiLead: Lead = {
        firstName: 'John 😊',
        companyName: 'TechCorp 🚀',
      }
      const template = 'Hi {firstName} from {companyName}!'
      const result = generateMessageFromTemplate(template, emojiLead)
      expect(result).toBe('Hi John 😊 from TechCorp 🚀!')
    })
  })
})

describe('newer lead fields', () => {
  const enrichedLead: Lead = {
    firstName: 'John',
    phoneNumber: '+1-280-754-0462',
    yearsAtCompany: 3,
    linkedinUrl: 'https://www.linkedin.com/in/john-roe',
  }

  it('renders the fields added after the first six', () => {
    const template = 'Reach {firstName} on {phoneNumber} or {linkedinUrl}'
    expect(generateMessageFromTemplate(template, enrichedLead)).toBe(
      'Reach John on +1-280-754-0462 or https://www.linkedin.com/in/john-roe'
    )
  })

  it('renders a numeric field as text', () => {
    expect(generateMessageFromTemplate('{yearsAtCompany} years', enrichedLead)).toBe('3 years')
  })

  it('does not treat zero years as a missing value', () => {
    expect(
      generateMessageFromTemplate('{yearsAtCompany} years', { ...enrichedLead, yearsAtCompany: 0 })
    ).toBe('0 years')
  })

  it('reports a field the lead has not been enriched with yet', () => {
    expect(() => generateMessageFromTemplate('Call {phoneNumber}', { firstName: 'John' })).toThrow(
      'Missing required field: phoneNumber'
    )
  })
})

describe('renderTemplate', () => {
  const lead: Lead = { firstName: 'John', companyName: 'Tech Corp' }

  it('fills what it can and leaves the rest visible', () => {
    const result = renderTemplate('Hi {firstName}, call {phoneNumber} about {companyName}', lead)

    expect(result.text).toBe('Hi John, call {phoneNumber} about Tech Corp')
    expect(result.issues).toEqual([{ field: 'phoneNumber', kind: 'missing' }])
  })

  it('reports each problem field once, in the order they appear', () => {
    const result = renderTemplate('{linkedinUrl} {nope} {linkedinUrl} {phoneNumber}', lead)

    expect(result.issues).toEqual([
      { field: 'linkedinUrl', kind: 'missing' },
      { field: 'nope', kind: 'unknown' },
      { field: 'phoneNumber', kind: 'missing' },
    ])
  })

  it('reports nothing for a template it can fill completely', () => {
    expect(renderTemplate('Hi {firstName}', lead)).toEqual({ text: 'Hi John', issues: [] })
  })

  it('does not let a value containing $& corrupt the output', () => {
    const result = renderTemplate('Hi {firstName}', { firstName: 'A$&B' })
    expect(result.text).toBe('Hi A$&B')
  })
})
