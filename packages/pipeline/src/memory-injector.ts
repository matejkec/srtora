import type {
  SessionMemory,
  TranslationMemory,
  TranslationResult,
  StoredTerm,
  StoredSpeaker,
  CorrectionEntry,
} from '@srtora/types'

/**
 * Merge persistent translation memory into the session memory extracted by the analysis phase.
 *
 * Session-extracted data takes priority over stored data when there are conflicts.
 * Terms and speakers from memory are filtered by language pair.
 */
export function mergeMemoryIntoSession(
  translationMemory: TranslationMemory,
  sessionMemory: SessionMemory | undefined,
  languagePair: string,
): SessionMemory {
  const base: SessionMemory = sessionMemory ?? {
    speakers: [],
    terms: [],
    warnings: [],
  }

  // Filter stored terms by language pair
  const relevantTerms = translationMemory.terms.filter(
    (t) => t.languagePair === languagePair,
  )

  // Merge terms: session terms take priority (keyed by source text, case-insensitive)
  const sessionTermSources = new Set(
    base.terms.map((t) => t.source.toLowerCase()),
  )
  const mergedTerms = [
    ...base.terms,
    ...relevantTerms
      .filter((t) => !sessionTermSources.has(t.source.toLowerCase()))
      .map((t) => ({ source: t.source, target: t.target, note: t.note })),
  ]

  // Merge speakers: session speakers take priority (keyed by label, case-insensitive)
  const sessionSpeakerLabels = new Set(
    base.speakers.map((s) => s.label.toLowerCase()),
  )
  const mergedSpeakers = [
    ...base.speakers,
    ...translationMemory.speakers
      .filter((s) => !sessionSpeakerLabels.has(s.label.toLowerCase()))
      .map((s) => ({
        id: s.id,
        label: s.label,
        aliases: s.aliases,
        gender: s.gender,
        genderConfidence: s.genderConfidence,
        register: s.register,
        notes: s.notes,
      })),
  ]

  return {
    ...base,
    terms: mergedTerms,
    speakers: mergedSpeakers,
  }
}

/**
 * Get recent corrections from translation memory for a given language pair.
 * Returns the most recent corrections (up to limit) for prompt injection.
 */
export function getRelevantCorrections(
  translationMemory: TranslationMemory,
  languagePair: string,
  limit = 20,
): CorrectionEntry[] {
  return translationMemory.corrections
    .filter((c) => c.languagePair === languagePair)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

/**
 * Extract memory updates from a completed translation result.
 *
 * Extracts new terms and speakers from the session memory for persistence.
 * The caller is responsible for persisting these to the memory store.
 */
export function extractMemoryUpdates(
  result: TranslationResult,
  languagePair: string,
  sourceFilename: string,
): { terms: StoredTerm[]; speakers: StoredSpeaker[] } {
  const now = new Date().toISOString()
  const terms: StoredTerm[] = []
  const speakers: StoredSpeaker[] = []

  if (result.sessionMemory) {
    for (const term of result.sessionMemory.terms) {
      terms.push({
        ...term,
        confidence: 1,
        createdAt: now,
        updatedAt: now,
        languagePair,
      })
    }

    for (const speaker of result.sessionMemory.speakers) {
      speakers.push({
        ...speaker,
        sourceFiles: [sourceFilename],
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  return { terms, speakers }
}
