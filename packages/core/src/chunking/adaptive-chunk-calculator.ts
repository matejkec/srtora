import type { SubtitleDocument } from '@srtora/types'
import type { OutputStrategyType } from '@srtora/types'
import { getCharsPerToken } from './token-estimator.js'

/** Minimum chunk size regardless of calculation */
const MIN_CHUNK_SIZE = 4
/** Conservative fallback when context window is unknown */
const FALLBACK_CONTEXT_TOKENS = 4096
/** Estimated tokens for JSON schema in structured mode */
const STRUCTURED_SCHEMA_OVERHEAD = 200
/** Estimated tokens for session memory section */
const MEMORY_OVERHEAD = 100
/** Fraction of target budget reserved for output tokens.
 *  Translation is roughly 1:1 in tokens, so reserve half. */
const OUTPUT_RESERVE_RATIO = 0.5

/**
 * Compute dynamic max chunk size based on total cue count.
 * Larger files can use larger chunks without losing quality.
 */
function dynamicMaxChunkSize(totalCues?: number): number {
  if (!totalCues) return 50
  if (totalCues >= 500) return 100
  if (totalCues >= 100) return 75
  return 50
}

export interface AdaptiveChunkParams {
  /** Model context window in tokens, or null if unknown */
  contextWindow: number | null
  /** Average tokens per cue (estimated) */
  avgCueTokens: number
  /** Number of lookbehind context cues */
  lookbehind: number
  /** Number of lookahead context cues */
  lookahead: number
  /** Target fraction of context window to use (0.2-0.9) */
  contextUsageTarget: number
  /** Output strategy affects overhead calculation */
  outputStrategy: OutputStrategyType
  /** System prompt overhead in tokens (default: 400) */
  systemPromptOverhead?: number
  /** Model's maxOutputTokens ceiling, or null if unknown */
  maxOutputTokens?: number | null
  /** Total cue count in the document (used for dynamic max chunk size) */
  totalCues?: number
}

/**
 * Calculate an adaptive chunk size based on model context window and cue characteristics.
 *
 * Algorithm:
 * 1. Determine available token budget from context window × usage target
 * 2. Subtract overheads (system prompt, schema, memory, context cues)
 * 3. Remaining budget → compute how many target cues fit
 * 4. Apply maxOutputTokens constraint if available
 * 5. Clamp to [MIN_CHUNK_SIZE, dynamic max]
 */
export function calculateAdaptiveChunkSize(params: AdaptiveChunkParams): number {
  const {
    contextWindow,
    avgCueTokens,
    lookbehind,
    lookahead,
    contextUsageTarget,
    outputStrategy,
    systemPromptOverhead = 400,
    maxOutputTokens,
    totalCues,
  } = params

  const maxChunkSize = dynamicMaxChunkSize(totalCues)

  // Ensure avgCueTokens is at least 1 to avoid division by zero
  const safeAvgCueTokens = Math.max(1, avgCueTokens)

  // 1. Total available tokens
  const effectiveContext = contextWindow ?? FALLBACK_CONTEXT_TOKENS
  const availableTokens = effectiveContext * contextUsageTarget

  // 2. Calculate overhead
  const schemaOverhead = outputStrategy === 'structured' ? STRUCTURED_SCHEMA_OVERHEAD : 0
  const contextCueTokens = (lookbehind + lookahead) * safeAvgCueTokens
  const totalOverhead = systemPromptOverhead + schemaOverhead + MEMORY_OVERHEAD + contextCueTokens

  // 3. Remaining budget for target cues (input + output)
  const targetBudget = Math.max(0, availableTokens - totalOverhead)
  const inputCueBudget = targetBudget * (1 - OUTPUT_RESERVE_RATIO)

  // 4. Compute optimal chunk size from context window
  let rawChunkSize = Math.floor(inputCueBudget / safeAvgCueTokens)

  // 5. Apply maxOutputTokens constraint if available
  // Each cue produces roughly 1 translated cue worth of output tokens
  if (maxOutputTokens && maxOutputTokens > 0) {
    const outputConstraint = Math.floor(maxOutputTokens / safeAvgCueTokens)
    rawChunkSize = Math.min(rawChunkSize, outputConstraint)
  }

  // 6. Clamp
  return Math.max(MIN_CHUNK_SIZE, Math.min(maxChunkSize, rawChunkSize))
}

/**
 * Estimate the average number of tokens per cue in a subtitle document.
 * Uses language-aware character-to-token ratios when a source language is provided.
 */
export function estimateAvgCueTokens(document: SubtitleDocument, sourceLanguage?: string): number {
  if (document.cues.length === 0) return 20 // reasonable default

  const charsPerToken = sourceLanguage ? getCharsPerToken(sourceLanguage) : 4
  const totalChars = document.cues.reduce((sum, cue) => sum + cue.plainText.length, 0)
  const avgChars = totalChars / document.cues.length
  return Math.max(5, Math.ceil(avgChars / charsPerToken))
}
