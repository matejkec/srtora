import type { SubtitleCue } from '@srtora/types'

/**
 * Builds the analysis prompt that extracts session memory from a sample of cues.
 * The LLM identifies speakers, recurring terms, tone, and potential issues.
 */
export function buildAnalysisPrompt(config: {
  sampleCues: SubtitleCue[]
  sourceLanguage: string
  targetLanguage: string
  tonePreference?: string
}): { system: string; user: string } {
  const { sampleCues, sourceLanguage, targetLanguage, tonePreference } = config

  const cueSample = sampleCues
    .map((c) => `[${c.sequence}] ${c.plainText}`)
    .join('\n')

  const system = `You are a subtitle analysis assistant. Your job is to analyze subtitle content and extract information that will help with translation.

Analyze the provided subtitle sample and return a JSON object with the following structure:
{
  "speakers": [
    {
      "id": "speaker_1",
      "label": "Name or description",
      "gender": "male" | "female" | "non-binary" | "unknown",
      "genderConfidence": 0.0 to 1.0,
      "register": "formal" | "informal" | "technical" | "colloquial" etc.,
      "notes": "Any relevant notes about this speaker"
    }
  ],
  "terms": [
    {
      "source": "term in source language",
      "target": "suggested translation",
      "note": "context or reasoning"
    }
  ],
  "warnings": ["Any issues or concerns about the content"],
  "toneProfile": "Description of the overall tone",
  "genreHint": "movie" | "tv_series" | "documentary" | "tutorial" | "interview" | etc.
}

Rules:
- Only include speakers you can identify with reasonable confidence
- Include proper nouns, technical terms, and recurring phrases in the terms list
- Suggest consistent translations for terms across the whole document
- Be concise in notes and warnings
- Return ONLY the JSON object, no other text`

  const toneNote = tonePreference ? `\nTone preference: ${tonePreference}` : ''

  const user = `Source language: ${sourceLanguage}
Target language: ${targetLanguage}${toneNote}

Subtitle sample (${sampleCues.length} cues):
${cueSample}`

  return { system, user }
}
