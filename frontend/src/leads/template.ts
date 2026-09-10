import { LeadFieldKey } from './fields'

/** Mirrors the placeholder syntax of renderTemplate in the backend. */
const PLACEHOLDER_SPLIT = /(\{\w+\})/g
const PLACEHOLDER = /^\{\w+\}$/

export interface TemplateSegment {
  text: string
  /** The field name when the segment is a placeholder, null when it is plain text. */
  field: string | null
}

/**
 * Splits a template into plain text and placeholders, keeping both, so the editor and the
 * preview can style placeholders without a rich text editor behind them.
 */
export const splitTemplate = (template: string): TemplateSegment[] =>
  template
    .split(PLACEHOLDER_SPLIT)
    .filter((segment) => segment !== '')
    .map((segment) =>
      PLACEHOLDER.test(segment)
        ? { text: segment, field: segment.slice(1, -1) }
        : { text: segment, field: null }
    )

type LeadValues = Partial<Record<LeadFieldKey, string | number | null>>

export const hasValue = (value: string | number | null | undefined): boolean =>
  value !== null && value !== undefined && value !== ''

/** How many of the selected leads could actually fill each field. */
export const countCoverage = (leads: LeadValues[], key: LeadFieldKey): number =>
  leads.filter((lead) => hasValue(lead[key])).length
