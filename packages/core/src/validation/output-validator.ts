import type { SubtitleDocument } from '@srtora/types'

export interface OutputValidationResult {
  valid: boolean
  issues: string[]
}

/**
 * Validates translation output against the source document.
 * Checks: same cue count, same sequences, no empty translations for non-empty sources.
 */
export function validateOutput(
  source: SubtitleDocument,
  translations: Map<number, string>,
): OutputValidationResult {
  const issues: string[] = []

  // Check cue count
  if (translations.size !== source.cueCount) {
    issues.push(
      `Translation count (${translations.size}) doesn't match source cue count (${source.cueCount})`,
    )
  }

  // Check each cue
  for (const cue of source.cues) {
    const translated = translations.get(cue.sequence)
    if (translated === undefined) {
      issues.push(`Missing translation for cue ${cue.sequence}`)
    } else if (translated.trim() === '' && cue.plainText.trim() !== '') {
      issues.push(`Empty translation for non-empty cue ${cue.sequence}`)
    }
  }

  // Check for extra translations
  for (const [id] of translations) {
    const exists = source.cues.some((c) => c.sequence === id)
    if (!exists) {
      issues.push(`Translation for non-existent cue ${id}`)
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
