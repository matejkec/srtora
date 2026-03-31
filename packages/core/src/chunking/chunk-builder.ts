import type { SubtitleCue, SubtitleDocument } from '@srtora/types'
import { getCharsPerToken } from './token-estimator.js'

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

// ── Token-Budget-First Chunk Builder ────────────────────────────

export interface TokenBudgetChunkConfig {
  /** Per-chunk token budget for target cues */
  targetTokenBudget: number
  /** Safety guardrail: max cue count per chunk */
  maxCueCount: number
  /** Source language for token estimation */
  sourceLanguage?: string
  /** Number of lookbehind context cues */
  lookbehind: number
  /** Number of lookahead context cues */
  lookahead: number
}

/**
 * Estimate the token count for a single cue.
 */
function estimateCueTokens(cue: SubtitleCue, charsPerToken: number): number {
  return Math.max(1, Math.ceil(cue.plainText.length / charsPerToken))
}

/**
 * Builds variable-size translation chunks based on a token budget.
 *
 * Instead of slicing by fixed cue count, accumulates cues into a chunk until
 * the estimated token budget is reached or the maxCueCount guardrail is hit.
 * This produces:
 * - Larger chunks when cues are short (one-word subtitles)
 * - Smaller chunks when cues are long (dense dialogue)
 *
 * Invariant: every cue is a target in exactly one chunk.
 */
export function buildChunksTokenBudget(
  document: SubtitleDocument,
  config: TokenBudgetChunkConfig,
): TranslationChunk[] {
  const { targetTokenBudget, maxCueCount, sourceLanguage, lookbehind, lookahead } = config
  const cues = document.cues
  const charsPerToken = sourceLanguage ? getCharsPerToken(sourceLanguage) : 4
  const chunks: TranslationChunk[] = []

  let start = 0
  let chunkIndex = 0

  while (start < cues.length) {
    let tokenAccum = 0
    let end = start

    // Accumulate cues until budget or max count is reached
    while (end < cues.length) {
      const cueTokens = estimateCueTokens(cues[end]!, charsPerToken)

      // Always include at least one cue per chunk
      if (end > start && (tokenAccum + cueTokens > targetTokenBudget || (end - start) >= maxCueCount)) {
        break
      }

      tokenAccum += cueTokens
      end++
    }

    const targetCues = cues.slice(start, end)

    const beforeStart = Math.max(0, start - lookbehind)
    const contextBefore = cues.slice(beforeStart, start)

    const afterEnd = Math.min(cues.length, end + lookahead)
    const contextAfter = cues.slice(end, afterEnd)

    chunkIndex++
    chunks.push({
      chunkId: `chunk_${String(chunkIndex).padStart(3, '0')}`,
      contextBefore,
      targetCues,
      contextAfter,
    })

    start = end
  }

  return chunks
}
