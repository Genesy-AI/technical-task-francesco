import { FC } from 'react'
import { LeadsGetManyOutput } from '../api/types/leads/getMany'
import { LEAD_FIELDS, LEAD_FIELD_GROUPS, LeadFieldDefinition } from '../leads/fields'

type Lead = LeadsGetManyOutput[number]

const linkHref = (field: LeadFieldDefinition, value: string): string | null => {
  switch (field.display) {
    case 'email':
      return `mailto:${value}`
    case 'tel':
      // Dialers cope with digits and a leading plus, not with the punctuation people type.
      return `tel:${value.replace(/[^\d+]/g, '')}`
    case 'url':
      return value
    default:
      return null
  }
}

const linkLabel = (field: LeadFieldDefinition, value: string): string =>
  field.display === 'url' ? value.replace(/^https?:\/\/(www\.)?/, '') : value

const FieldValue: FC<{ field: LeadFieldDefinition; value: string | number | null }> = ({ field, value }) => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400">Not set</span>
  }

  const text = String(value)
  const href = linkHref(field, text)

  if (!href) return <span className="text-gray-900">{text}</span>

  return (
    <a
      href={href}
      target={field.display === 'url' ? '_blank' : undefined}
      rel="noreferrer"
      className="text-blue-600 hover:text-blue-500 break-all"
    >
      {linkLabel(field, text)}
    </a>
  )
}

/**
 * Everything known about a lead, straight from the field registry: a field added there shows
 * up here without this component changing.
 */
export const LeadDetailPanel: FC<{ lead: Lead }> = ({ lead }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 py-4 bg-gray-50 border-l-4 border-blue-200">
    {LEAD_FIELD_GROUPS.map((group) => (
      <div key={group}>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{group}</h4>
        <dl className="space-y-1">
          {LEAD_FIELDS.filter((field) => field.group === group).map((field) => (
            <div key={field.key} className="flex gap-2 text-sm">
              <dt className="w-32 flex-shrink-0 text-gray-500">{field.label}</dt>
              <dd className="min-w-0">
                <FieldValue field={field} value={lead[field.key]} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    ))}
  </div>
)
