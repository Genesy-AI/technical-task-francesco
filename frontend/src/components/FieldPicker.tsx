import { FC, useMemo, useState } from 'react'
import { LEAD_FIELDS, LEAD_FIELD_GROUPS, LeadFieldKey } from '../leads/fields'

interface FieldPickerProps {
  /** How many of the selected leads can fill each field. */
  coverage: ReadonlyMap<LeadFieldKey, number>
  totalLeads: number
  onInsert: (field: LeadFieldKey) => void
}

const coverageClasses = (filled: number, total: number): string => {
  if (filled === 0) return 'bg-red-50 text-red-800 hover:bg-red-100'
  if (filled < total) return 'bg-amber-50 text-amber-800 hover:bg-amber-100'
  return 'bg-blue-50 text-blue-800 hover:bg-blue-100'
}

/**
 * Field list for the template editor. Grouped and searchable so it stays usable as fields are
 * added, and annotated with coverage so a placeholder that will fail on half the batch says so
 * before Generate is pressed.
 */
export const FieldPicker: FC<FieldPickerProps> = ({ coverage, totalLeads, onInsert }) => {
  const [search, setSearch] = useState('')

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return LEAD_FIELDS
    return LEAD_FIELDS.filter(
      (field) => field.key.toLowerCase().includes(term) || field.label.toLowerCase().includes(term)
    )
  }, [search])

  return (
    <div className="space-y-3">
      <label htmlFor="field-search" className="block text-sm font-medium text-gray-700">
        Fields
      </label>
      <input
        id="field-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search fields"
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />

      {matches.length === 0 && <p className="text-sm text-gray-500">No field matches "{search}".</p>}

      {LEAD_FIELD_GROUPS.map((group) => {
        const fields = matches.filter((field) => field.group === group)
        if (fields.length === 0) return null

        return (
          <div key={group}>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{group}</h4>
            <div className="space-y-1">
              {fields.map((field) => {
                const filled = coverage.get(field.key) ?? 0

                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => onInsert(field.key)}
                    title={`Insert {${field.key}}, filled on ${filled} of ${totalLeads} selected leads`}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1 text-xs rounded transition-colors ${coverageClasses(filled, totalLeads)}`}
                  >
                    <span className="font-mono truncate">{`{${field.key}}`}</span>
                    <span className="flex-shrink-0 tabular-nums opacity-80">
                      {filled}/{totalLeads}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
