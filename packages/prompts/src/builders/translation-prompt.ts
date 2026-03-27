import type { SubtitleCue, SessionMemory, CorrectionEntry } from '@srtora/types'

/**
 * Builds the translation prompt for a chunk of subtitle cues.
 * Includes context cues (lookbehind/lookahead) and session memory.
 */
export function buildTranslationPrompt(config: {
  targetCues: SubtitleCue[]
  contextBefore: SubtitleCue[]
  contextAfter: SubtitleCue[]
  previousTranslations?: Map<number, string>
  sessionMemory?: SessionMemory | null
  sourceLanguage: string
  targetLanguage: string
  tonePreference?: string
  /** Known corrections from translation memory (optional) */
  corrections?: CorrectionEntry[]
}): { system: string; user: string } {
  const {
    targetCues,
    contextBefore,
    contextAfter,
    previousTranslations,
    sessionMemory,
    sourceLanguage,
    targetLanguage,
    tonePreference,
    corrections,
  } = config

  // Build memory context section
  let memorySection = ''
  if (sessionMemory) {
    const parts: string[] = []

    if (sessionMemory.speakers.length > 0) {
      const speakerList = sessionMemory.speakers
        .map((s) => {
          let desc = `${s.label}`
          if (s.gender !== 'unknown') desc += ` (${s.gender})`
          if (s.register) desc += ` — ${s.register} register`
          return `  - ${desc}`
        })
        .join('\n')
      parts.push(`Speakers:\n${speakerList}`)
    }

    if (sessionMemory.terms.length > 0) {
      const termList = sessionMemory.terms
        .map((t) => `  - "${t.source}" → "${t.target}"${t.note ? ` (${t.note})` : ''}`)
        .join('\n')
      parts.push(`Terminology:\n${termList}`)
    }

    if (sessionMemory.toneProfile) {
      parts.push(`Tone: ${sessionMemory.toneProfile}`)
    }

    if (parts.length > 0) {
      memorySection = `\n\nSession context:\n${parts.join('\n')}`
    }
  }

  // Build corrections section from translation memory
  let correctionsSection = ''
  if (corrections && corrections.length > 0) {
    const correctionList = corrections
      .slice(0, 10) // limit to avoid prompt bloat
      .map((c) => `  - "${c.originalTranslation}" → "${c.correctedTranslation}"${c.reason ? ` (${c.reason})` : ''}`)
      .join('\n')
    correctionsSection = `\n\nKnown corrections from previous translations:\n${correctionList}`
  }

  const toneNote = tonePreference ? `\nTone preference: ${tonePreference}` : ''

  const system = `You are a professional subtitle translator. Translate the TRANSLATE cues from ${sourceLanguage} to ${targetLanguage}.

Output rules:
- Return a JSON object: {"translations": [{"id": <sequence number>, "text": "<translated text>"}]}
- Translate ONLY the cues marked [TRANSLATE], not the context cues
- Preserve line breaks (\\n) in multi-line cues
- Preserve ALL formatting tags exactly as they appear (<b>, </b>, <i>, </i>, <u>, </u>, <font ...>, </font>, etc.)
- Keep translations natural and appropriate for subtitles (concise, readable)
- Maintain consistency with the provided terminology and session context
- Do not add or remove cues — translate each one exactly once
- Return ONLY the JSON object, no other text${toneNote}${memorySection}${correctionsSection}`

  // Build user prompt with context and target cues
  const lines: string[] = []

  if (contextBefore.length > 0) {
    lines.push('--- CONTEXT (already translated) ---')
    for (const cue of contextBefore) {
      const prevTranslation = previousTranslations?.get(cue.sequence)
      if (prevTranslation) {
        lines.push(`[${cue.sequence}] ${cue.rawText} → ${prevTranslation}`)
      } else {
        lines.push(`[${cue.sequence}] ${cue.rawText}`)
      }
    }
    lines.push('')
  }

  lines.push('--- TRANSLATE ---')
  for (const cue of targetCues) {
    lines.push(`[${cue.sequence}] ${cue.rawText}`)
  }

  if (contextAfter.length > 0) {
    lines.push('')
    lines.push('--- CONTEXT (upcoming) ---')
    for (const cue of contextAfter) {
      lines.push(`[${cue.sequence}] ${cue.rawText}`)
    }
  }

  return { system, user: lines.join('\n') }
}

/**
 * JSON schema for structured output enforcement.
 * Compatible with both Ollama `format` and OpenAI `response_format.json_schema`.
 */
export const translationOutputSchema = {
  type: 'object' as const,
  properties: {
    translations: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'number' as const },
          text: { type: 'string' as const },
        },
        required: ['id', 'text'],
      },
    },
  },
  required: ['translations'],
}
