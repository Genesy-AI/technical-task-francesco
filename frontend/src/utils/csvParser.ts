import Papa from 'papaparse'
import { LEAD_FIELDS, LeadFieldKey, LeadFieldValues, findFieldByCsvHeader } from '../leads/fields'

export { isValidEmail } from '../leads/fields'

export type CsvLead = Omit<LeadFieldValues, 'firstName' | 'lastName' | 'email'> & {
  firstName: string
  lastName: string
  email: string
  isValid: boolean
  /** A required field the row cannot be imported without. */
  errors: string[]
  /** An optional value that will be dropped. The row still imports. */
  warnings: string[]
  rowIndex: number
}

// The registry is keyed by field name while LeadFieldValues types each field on its own, so
// one cast is needed to bridge them. parse() is what guarantees the value matches the type.
const setFieldValue = (values: LeadFieldValues, key: LeadFieldKey, value: string | number): void => {
  ;(values as Record<LeadFieldKey, string | number>)[key] = value
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  // Columns we do not model are ignored on purpose: a CRM export carries plenty of them.
  const columns = (parseResult.meta.fields ?? []).flatMap((header) => {
    const field = findFieldByCsvHeader(header)
    return field ? [{ header, field }] : []
  })

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const rawByKey = new Map<LeadFieldKey, string>(
      columns.map(({ header, field }) => [field.key, row[header] ?? ''])
    )

    const values: LeadFieldValues = {}
    const errors: string[] = []
    const warnings: string[] = []

    for (const field of LEAD_FIELDS) {
      const { value, error } = field.parse(rawByKey.get(field.key) ?? '')

      if (error) {
        if (field.required) {
          errors.push(error)
        } else {
          warnings.push(`${field.label} ignored: ${error}`)
        }
        continue
      }

      if (value !== null) setFieldValue(values, field.key, value)
    }

    data.push({
      ...values,
      firstName: values.firstName ?? '',
      lastName: values.lastName ?? '',
      email: values.email ?? '',
      isValid: errors.length === 0,
      errors,
      warnings,
      rowIndex: index + 2,
    })
  })

  return data
}
