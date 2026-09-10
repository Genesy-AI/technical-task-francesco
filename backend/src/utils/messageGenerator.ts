import { LEAD_FIELDS_BY_KEY, Lead } from '../leads/fields'

export type { Lead } from '../leads/fields'

export type TemplateIssueKind = 'missing' | 'unknown'

export interface TemplateIssue {
  field: string
  kind: TemplateIssueKind
}

export interface RenderedTemplate {
  /** Placeholders that could not be resolved are left as written, so a preview can show them. */
  text: string
  /** In order of first appearance, one entry per field. */
  issues: TemplateIssue[]
}

const PLACEHOLDER = /\{(\w+)\}/g

/**
 * Fills a template as far as it can and reports what it could not fill. Rendering and
 * validation live together so the preview cannot disagree with what generation produces.
 */
export function renderTemplate(template: string, lead: Lead): RenderedTemplate {
  const issues: TemplateIssue[] = []
  const reported = new Set<string>()

  const report = (field: string, kind: TemplateIssueKind) => {
    if (reported.has(field)) return
    reported.add(field)
    issues.push({ field, kind })
  }

  const text = template.replace(PLACEHOLDER, (placeholder, fieldName: string) => {
    const field = LEAD_FIELDS_BY_KEY.get(fieldName)

    if (!field) {
      report(fieldName, 'unknown')
      return placeholder
    }

    const value = lead[field.key]
    if (value === null || value === undefined || value === '') {
      report(fieldName, 'missing')
      return placeholder
    }

    return String(value)
  })

  return { text, issues }
}

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  const { text, issues } = renderTemplate(template, lead)
  const [issue] = issues

  if (issue) {
    throw new Error(
      issue.kind === 'unknown'
        ? `Unknown field in template: ${issue.field}`
        : `Missing required field: ${issue.field}`
    )
  }

  return text
}
