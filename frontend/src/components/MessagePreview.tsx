import { FC, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { LeadsGetManyOutput } from '../api/types/leads/getMany'
import { splitTemplate } from '../leads/template'

type Lead = LeadsGetManyOutput[number]

interface MessagePreviewProps {
  leads: Lead[]
  template: string
}

const PREVIEW_DEBOUNCE_MS = 300

const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/**
 * Renders the template against one selected lead at a time, through the same endpoint that
 * generation uses, so the preview cannot promise something Generate would refuse.
 */
export const MessagePreview: FC<MessagePreviewProps> = ({ leads, template }) => {
  const [index, setIndex] = useState(0)
  const debouncedTemplate = useDebouncedValue(template.trim(), PREVIEW_DEBOUNCE_MS)

  // Selection changes under us when the user reopens the modal with a different batch.
  const lead = leads[Math.min(index, leads.length - 1)]

  const preview = useQuery({
    queryKey: ['leads', 'previewMessage', lead?.id, debouncedTemplate],
    queryFn: async () => api.leads.previewMessage({ leadId: lead.id, template: debouncedTemplate }),
    enabled: Boolean(lead) && debouncedTemplate.length > 0,
    retry: false,
  })

  const unknownFields = useMemo(
    () => preview.data?.issues.filter((issue) => issue.kind === 'unknown') ?? [],
    [preview.data]
  )

  if (!lead) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="block text-sm font-medium text-gray-700">Preview</span>
        {leads.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button
              type="button"
              onClick={() => setIndex((current) => Math.max(0, current - 1))}
              disabled={index === 0}
              className="px-2 py-0.5 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Previous lead
            </button>
            <span className="tabular-nums">
              {Math.min(index, leads.length - 1) + 1} of {leads.length}
            </span>
            <button
              type="button"
              onClick={() => setIndex((current) => Math.min(leads.length - 1, current + 1))}
              disabled={index >= leads.length - 1}
              className="px-2 py-0.5 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next lead
            </button>
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-md bg-gray-50 px-3 py-2 min-h-24 text-sm whitespace-pre-wrap break-words">
        {!debouncedTemplate && <span className="text-gray-500">Write a template to see it filled in.</span>}

        {debouncedTemplate && preview.isError && (
          <span className="text-red-600">Could not build a preview for {lead.firstName}.</span>
        )}

        {debouncedTemplate &&
          preview.data &&
          splitTemplate(preview.data.text).map((segment, segmentIndex) =>
            segment.field === null ? (
              <span key={segmentIndex}>{segment.text}</span>
            ) : (
              <span key={segmentIndex} className="rounded px-0.5 bg-red-100 text-red-800">
                {segment.text}
              </span>
            )
          )}
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Showing {lead.firstName} {lead.lastName || ''}
      </p>

      {unknownFields.length > 0 && (
        <p className="mt-1 text-xs text-red-600">
          {unknownFields.map((issue) => `{${issue.field}}`).join(', ')} is not a lead field, so no message
          will be generated.
        </p>
      )}
    </div>
  )
}
