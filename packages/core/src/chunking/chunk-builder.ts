import type { SubtitleCue, SubtitleDocument } from '@srtora/types'

export interface TranslationChunk {
  chunkId: string
  /** Cues in lookbehind context (already translated, for context only) */
  contextBefore: SubtitleCue[]
  /** Cues to translate in this chunk */
  targetCues: SubtitleCue[]
  /** Cues in lookahead context (not yet translated, for context only) */
  contextAfter: SubtitleCue[]
}

/**
 * Builds overlapping translation chunks from a subtitle document.
 * Primary windows do not overlap — each cue is translated exactly once.
 * Context cues (lookbehind/lookahead) provide continuity.
 */
export function buildChunks(
  document: SubtitleDocument,
  config: { chunkSize: number; lookbehind: number; lookahead: number },
): TranslationChunk[] {
  const { chunkSize, lookbehind, lookahead } = config
  const cues = document.cues
  const chunks: TranslationChunk[] = []

  for (let start = 0; start < cues.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, cues.length)
    const targetCues = cues.slice(start, end)

    const beforeStart = Math.max(0, start - lookbehind)
    const contextBefore = cues.slice(beforeStart, start)

    const afterEnd = Math.min(cues.length, end + lookahead)
    const contextAfter = cues.slice(end, afterEnd)

    const chunkIndex = Math.floor(start / chunkSize)
    chunks.push({
      chunkId: `chunk_${String(chunkIndex + 1).padStart(3, '0')}`,
      contextBefore,
      targetCues,
      contextAfter,
    })
  }

  return chunks
}
