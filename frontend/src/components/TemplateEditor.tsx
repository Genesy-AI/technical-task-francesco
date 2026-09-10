import { FC, RefObject, useRef } from 'react'
import { splitTemplate } from '../leads/template'

export type PlaceholderState = 'complete' | 'partial' | 'empty' | 'unknown'

interface TemplateEditorProps {
  value: string
  onChange: (value: string) => void
  /** How the placeholder should read: coverage for known fields, unknown for the rest. */
  stateOf: (field: string) => PlaceholderState
  textareaRef: RefObject<HTMLTextAreaElement>
}

const PILL_CLASSES: Record<PlaceholderState, string> = {
  complete: 'bg-blue-100 text-blue-800',
  partial: 'bg-amber-100 text-amber-800',
  empty: 'bg-red-100 text-red-800',
  unknown: 'bg-red-100 text-red-800 line-through',
}

// The pills are painted on a mirror of the textarea rather than in a rich text editor, so the
// caret, undo, paste and screen reader behaviour stay native. Both layers must keep identical
// typography and padding or the two drift apart.
const SHARED_TEXT_CLASSES =
  'w-full h-40 px-3 py-2 text-sm leading-6 font-sans whitespace-pre-wrap break-words'

export const TemplateEditor: FC<TemplateEditorProps> = ({ value, onChange, stateOf, textareaRef }) => {
  const backdropRef = useRef<HTMLDivElement>(null)

  return (
    <div className="relative border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      <div
        ref={backdropRef}
        aria-hidden="true"
        className={`${SHARED_TEXT_CLASSES} absolute inset-0 overflow-hidden text-gray-900 pointer-events-none`}
      >
        {splitTemplate(value).map((segment, index) =>
          segment.field === null ? (
            <span key={index}>{segment.text}</span>
          ) : (
            <span key={index} className={`rounded px-0.5 ${PILL_CLASSES[stateOf(segment.field)]}`}>
              {segment.text}
            </span>
          )
        )}
        {/* A trailing newline is not laid out unless something follows it. */}
        {'\u200b'}
      </div>

      <textarea
        ref={textareaRef}
        id="message-template"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop
        }}
        placeholder="Enter your message template here. Use {fieldName} to insert dynamic values.&#10;&#10;Example: Hi {firstName}, I noticed you work at {companyName} as a {jobTitle}. Would you be interested in..."
        className={`${SHARED_TEXT_CLASSES} relative bg-transparent text-transparent caret-gray-900 placeholder:text-gray-400 resize-none focus:outline-none`}
        required
      />
    </div>
  )
}
