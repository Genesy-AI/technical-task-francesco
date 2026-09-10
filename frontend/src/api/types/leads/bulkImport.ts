import { LeadFieldValues } from '../../../leads/fields'

export interface LeadsBulkImportInput {
  leads: (LeadFieldValues & {
    firstName: string
    lastName: string
    email: string
  })[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  /** Optional values the server refused, on leads it imported anyway. */
  droppedValues: Array<{
    leadName: string
    field: string
    reason: string
  }>
  errors: Array<{
    lead: LeadsBulkImportInput['leads'][number]
    error: string
  }>
}
