import type { SubtitleCue, SessionMemory, ReviewFlag } from '@srtora/types'

/**
 * Builds the review prompt for flagged translations.
 * The LLM reviews and corrects translations that have potential issues.
 */
export function buildReviewPrompt(config: {
  flags: ReviewFlag[]
  allCues: SubtitleCue[]
  translations: Map<number, string>
  sessionMemory?: SessionMemory | null
  sourceLanguage: string
  targetLanguage: string
}): { system: string; user: string } {
  const { flags, allCues, translations, sessionMemory, sourceLanguage, targetLanguage } = config

  let memorySection = ''
  if (sessionMemory?.terms && sessionMemory.terms.length > 0) {
    const termList = sessionMemory.terms
      .map((t) => `  - "${t.source}" → "${t.target}"`)
      .join('\n')
    memorySection = `\n\nEstablished terminology:\n${termList}`
  }

  const system = `You are a professional subtitle reviewer. Review the flagged translations and provide corrected versions where needed.

Output rules:
- Return a JSON object: {"corrections": [{"id": <sequence number>, "text": "<corrected text>"}], "warnings": ["any additional warnings"]}
- Only include cues that actually need correction
- Preserve formatting tags exactly as they appear
- Keep translations natural and concise for subtitles
- Return ONLY the JSON object, no other text${memorySection}`

  const flagLines: string[] = []
  for (const flag of flags) {
    const cue = allCues.find((c) => c.sequence === flag.cueSequence)
    const translation = translations.get(flag.cueSequence)
    flagLines.push(
      `[${flag.cueSequence}] Issue: ${flag.reason} — ${flag.details}`,
      `  Source (${sourceLanguage}): ${cue?.rawText ?? flag.sourceText}`,
      `  Current (${targetLanguage}): ${translation ?? flag.currentTranslation}`,
      '',
    )
  }

  const user = `Review these flagged translations:\n\n${flagLines.join('\n')}`

  return { system, user }
}

/**
 * Automated flagging of potential issues before sending to review LLM.
 */
export function flagTranslations(config: {
  cues: SubtitleCue[]
  translations: Map<number, string>
  sessionMemory?: SessionMemory | null
}): ReviewFlag[] {
  const { cues, translations, sessionMemory } = config
  const flags: ReviewFlag[] = []

  for (const cue of cues) {
    const translation = translations.get(cue.sequence)
    if (!translation) continue

    // Flag empty translations for non-empty source
    if (cue.plainText.trim() && !translation.trim()) {
      flags.push({
        cueSequence: cue.sequence,
        reason: 'empty_translation',
        details: 'Translation is empty but source has content',
        sourceText: cue.rawText,
        currentTranslation: translation,
      })
      continue
    }

    // Flag missing formatting tags
    if (cue.inlineTags.length > 0) {
      const missingTags = cue.inlineTags.filter((tag) => !translation.includes(tag))
      if (missingTags.length > 0) {
        flags.push({
          cueSequence: cue.sequence,
          reason: 'missing_tag',
          details: `Missing tags: ${missingTags.join(', ')}`,
          sourceText: cue.rawText,
          currentTranslation: translation,
        })
      }
    }

    // Flag significant length differences (> 3x)
    const sourceLen = cue.plainText.length
    const targetLen = translation.length
    if (sourceLen > 10 && (targetLen > sourceLen * 3 || targetLen < sourceLen * 0.2)) {
      flags.push({
        cueSequence: cue.sequence,
        reason: 'length_issue',
        details: `Source: ${sourceLen} chars, Translation: ${targetLen} chars (${Math.round((targetLen / sourceLen) * 100)}%)`,
        sourceText: cue.rawText,
        currentTranslation: translation,
      })
    }

    // Flag term inconsistency
    if (sessionMemory?.terms) {
      for (const term of sessionMemory.terms) {
        const sourceHasTerm = cue.plainText.toLowerCase().includes(term.source.toLowerCase())
        const targetHasTerm = translation.toLowerCase().includes(term.target.toLowerCase())
        if (sourceHasTerm && !targetHasTerm) {
          flags.push({
            cueSequence: cue.sequence,
            reason: 'term_inconsistency',
            details: `Expected "${term.target}" for "${term.source}"`,
            sourceText: cue.rawText,
            currentTranslation: translation,
          })
          break // One flag per cue for term issues
        }
      }
    }
  }

  return flags
}
