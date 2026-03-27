import type { SubtitleDocument, ChunkTranslationResult } from '@srtora/types'
import type { TranslationChunk } from './chunk-builder.js'

/**
 * Merges chunk translation results into a single translations map.
 * Validates that every cue has exactly one translation.
 */
export function mergeChunkResults(
  chunks: TranslationChunk[],
  results: ChunkTranslationResult[],
  document: SubtitleDocument,
): { translations: Map<number, string>; warnings: string[] } {
  const translations = new Map<number, string>()
  const warnings: string[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!
    const chunk = chunks[i]!

    for (const item of result.items) {
      // Validate this item belongs to the chunk's target cues
      const isTargetCue = chunk.targetCues.some((c) => c.sequence === item.id)
      if (!isTargetCue) {
        warnings.push(
          `Chunk ${result.chunkId}: translation for cue ${item.id} is not a target cue, ignoring`,
        )
        continue
      }

      if (translations.has(item.id)) {
        warnings.push(
          `Chunk ${result.chunkId}: duplicate translation for cue ${item.id}, keeping first`,
        )
        continue
      }

      translations.set(item.id, item.text)
    }
  }

  // Check for missing translations
  for (const cue of document.cues) {
    if (!translations.has(cue.sequence)) {
      warnings.push(`Missing translation for cue ${cue.sequence}`)
    }
  }

  return { translations, warnings }
}
