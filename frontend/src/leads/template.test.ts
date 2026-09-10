import { describe, it, expect } from 'vitest'
import { countCoverage, hasValue, splitTemplate } from './template'

describe('splitTemplate', () => {
  it('keeps plain text and placeholders in order', () => {
    expect(splitTemplate('Hi {firstName}, welcome')).toEqual([
      { text: 'Hi ', field: null },
      { text: '{firstName}', field: 'firstName' },
      { text: ', welcome', field: null },
    ])
  })

  it('does not carry regex state between calls', () => {
    const template = '{firstName} {lastName}'
    expect(splitTemplate(template)).toEqual(splitTemplate(template))
  })

  it('leaves text that only looks like a placeholder alone', () => {
    expect(splitTemplate('a {first name} {} {')).toEqual([{ text: 'a {first name} {} {', field: null }])
  })

  it('returns nothing for an empty template', () => {
    expect(splitTemplate('')).toEqual([])
  })
})

describe('countCoverage', () => {
  const leads = [
    { firstName: 'John', phoneNumber: '+34 611 22 33 44', yearsAtCompany: 0 },
    { firstName: 'Jane', phoneNumber: null },
    { firstName: 'Bob', phoneNumber: '' },
  ]

  it('counts only the leads that could fill the field', () => {
    expect(countCoverage(leads, 'phoneNumber')).toBe(1)
    expect(countCoverage(leads, 'firstName')).toBe(3)
  })

  it('counts a zero as a real value', () => {
    expect(hasValue(0)).toBe(true)
    expect(countCoverage(leads, 'yearsAtCompany')).toBe(1)
  })
})
