import type { SubtitleDocument } from '@srtora/types'
import type { OutputStrategyType } from '@srtora/types'

/** Minimum chunk size regardless of calculation */
const MIN_CHUNK_SIZE = 4
/** Maximum chunk size regardless of calculation */
const MAX_CHUNK_SIZE = 50
/** Conservative fallback when context window is unknown */
const FALLBACK_CONTEXT_TOKENS = 4096
/** Estimated tokens for the system prompt */
const SYSTEM_PROMPT_OVERHEAD = 400
/** Estimated tokens for JSON schema in structured mode */
const STRUCTURED_SCHEMA_OVERHEAD = 200
/** Estimated tokens for session memory section */
const MEMORY_OVERHEAD = 100
/** Fraction of target budget reserved for output tokens */
const OUTPUT_RESERVE_RATIO = 0.4

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
}

/**
 * Calculate an adaptive chunk size based on model context window and cue characteristics.
 *
 * Algorithm:
 * 1. Determine available token budget from context window × usage target
 * 2. Subtract fixed overheads (system prompt, schema, memory, context cues)
 * 3. Remaining budget → compute how many target cues fit
 * 4. Clamp to [MIN_CHUNK_SIZE, MAX_CHUNK_SIZE]
 */
export function calculateAdaptiveChunkSize(params: AdaptiveChunkParams): number {
  const { contextWindow, avgCueTokens, lookbehind, lookahead, contextUsageTarget, outputStrategy } = params

  // Ensure avgCueTokens is at least 1 to avoid division by zero
  const safeAvgCueTokens = Math.max(1, avgCueTokens)

  // 1. Total available tokens
  const effectiveContext = contextWindow ?? FALLBACK_CONTEXT_TOKENS
  const availableTokens = effectiveContext * contextUsageTarget

  // 2. Calculate overhead
  const schemaOverhead = outputStrategy === 'structured' ? STRUCTURED_SCHEMA_OVERHEAD : 0
  const contextCueTokens = (lookbehind + lookahead) * safeAvgCueTokens
  const totalOverhead = SYSTEM_PROMPT_OVERHEAD + schemaOverhead + MEMORY_OVERHEAD + contextCueTokens

  // 3. Remaining budget for target cues (input + output)
  const targetBudget = Math.max(0, availableTokens - totalOverhead)
  const inputCueBudget = targetBudget * (1 - OUTPUT_RESERVE_RATIO)

  // 4. Compute optimal chunk size
  const rawChunkSize = Math.floor(inputCueBudget / safeAvgCueTokens)

  // 5. Clamp
  return Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, rawChunkSize))
}

/**
 * Estimate the average number of tokens per cue in a subtitle document.
 * Uses a simple character-count heuristic: ~4 characters per token.
 * This is intentionally approximate — precision is not needed for chunk sizing.
 */
export function estimateAvgCueTokens(document: SubtitleDocument): number {
  if (document.cues.length === 0) return 20 // reasonable default

  const totalChars = document.cues.reduce((sum, cue) => sum + cue.plainText.length, 0)
  const avgChars = totalChars / document.cues.length
  return Math.max(5, Math.ceil(avgChars / 4))
}
