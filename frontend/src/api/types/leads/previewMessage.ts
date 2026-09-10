export type LeadsPreviewMessageInput = {
  leadId: number
  template: string
}

export type LeadsPreviewMessageOutput = {
  /** Placeholders that could not be resolved are left as written. */
  text: string
  issues: Array<{
    field: string
    kind: 'missing' | 'unknown'
  }>
}
