import type { SubtitleDocument } from '@srtora/types'

export interface ValidationIssue {
  type: 'error' | 'warning'
  message: string
  cueSequence?: number
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

/**
 * Validates a parsed subtitle document for structural correctness.
 */
export function validateDocument(document: SubtitleDocument): ValidationResult {
  const issues: ValidationIssue[] = []

  if (document.cues.length === 0) {
    issues.push({ type: 'error', message: 'Document contains no cues' })
  }

  if (document.cueCount !== document.cues.length) {
    issues.push({
      type: 'error',
      message: `Cue count mismatch: declared ${document.cueCount}, actual ${document.cues.length}`,
    })
  }

  for (const cue of document.cues) {
    if (cue.endMs <= cue.startMs) {
      issues.push({
        type: 'warning',
        message: `Cue ${cue.sequence}: end time (${cue.endMs}ms) <= start time (${cue.startMs}ms)`,
        cueSequence: cue.sequence,
      })
    }
  }

  return {
    valid: issues.every((i) => i.type !== 'error'),
    issues,
  }
}
