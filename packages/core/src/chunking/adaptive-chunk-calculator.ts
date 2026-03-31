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
/** Default fraction of target budget reserved for output tokens.
 *  Translation is roughly 1:1 in tokens, so reserve half. */
const DEFAULT_OUTPUT_RESERVE_RATIO = 0.5

/**
 * Compute dynamic max chunk size based on total cue count.
 * Raised ceilings: 100/200/300 (was 50/75/100) — acts as safety guardrail only,
 * not the primary sizing constraint. Token budget is the real limiter.
 */
function dynamicMaxChunkSize(totalCues?: number): number {
  if (!totalCues) return 100
  if (totalCues >= 500) return 300
  if (totalCues >= 100) return 200
  return 100
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
  /** Pre-calculated safe input budget. If set, replaces contextWindow × contextUsageTarget. */
  safeInputBudget?: number | null
  /** Hard ceiling on chunk size (cue count). If set, additional clamp applied on top of dynamic max. */
  hardChunkCeiling?: number | null
  /** Fraction of maxOutputTokens to actually use (0-1). Scales the output reserve.
   *  Models that degrade at high output length should use lower values. Default: 0.85 */
  outputStabilityThreshold?: number
}

/**
 * Calculate an adaptive chunk size based on model context window and cue characteristics.
 *
 * Algorithm:
 * 1. Determine available token budget from context window × usage target (or safeInputBudget override)
 * 2. Subtract overheads (system prompt, schema, memory, context cues)
 * 3. Remaining budget → compute how many target cues fit
 * 4. Apply maxOutputTokens constraint if available (scaled by outputStabilityThreshold)
 * 5. Clamp to [MIN_CHUNK_SIZE, min(dynamic max, hardChunkCeiling)]
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
    safeInputBudget,
    hardChunkCeiling,
    outputStabilityThreshold = 0.85,
  } = params

  let maxChunkSize = dynamicMaxChunkSize(totalCues)

  // Apply hard chunk ceiling if set
  if (hardChunkCeiling != null && hardChunkCeiling > 0) {
    maxChunkSize = Math.min(maxChunkSize, hardChunkCeiling)
  }

  // Ensure avgCueTokens is at least 1 to avoid division by zero
  const safeAvgCueTokens = Math.max(1, avgCueTokens)

  // 1. Total available tokens — use safeInputBudget if provided, else derive
  const availableTokens = (safeInputBudget != null && safeInputBudget > 0)
    ? safeInputBudget
    : (contextWindow ?? FALLBACK_CONTEXT_TOKENS) * contextUsageTarget

  // 2. Calculate overhead
  const schemaOverhead = outputStrategy === 'structured' ? STRUCTURED_SCHEMA_OVERHEAD : 0
  const contextCueTokens = (lookbehind + lookahead) * safeAvgCueTokens
  const totalOverhead = systemPromptOverhead + schemaOverhead + MEMORY_OVERHEAD + contextCueTokens

  // 3. Remaining budget for target cues (input + output)
  const targetBudget = Math.max(0, availableTokens - totalOverhead)
  const inputCueBudget = targetBudget * (1 - DEFAULT_OUTPUT_RESERVE_RATIO)

  // 4. Compute optimal chunk size from context window
  let rawChunkSize = Math.floor(inputCueBudget / safeAvgCueTokens)

  // 5. Apply maxOutputTokens constraint scaled by stability threshold
  // Each cue produces roughly 1 translated cue worth of output tokens
  if (maxOutputTokens && maxOutputTokens > 0) {
    const effectiveOutputBudget = maxOutputTokens * outputStabilityThreshold
    const outputConstraint = Math.floor(effectiveOutputBudget / safeAvgCueTokens)
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

// ── Token-Budget-First Chunking ──────────────────────────────────

export interface AdaptiveChunkBudget {
  /** Per-chunk token budget for target cues (input side) */
  targetTokenBudget: number
  /** Safety guardrail: max cue count per chunk */
  maxCueCount: number
  /** Estimated average tokens per cue */
  avgCueTokens: number
}

/**
 * Calculate a token-budget-first chunk sizing.
 *
 * Instead of returning a cue count, returns a token budget that the chunk builder
 * uses to accumulate cues until the budget is reached. This produces variable-size
 * chunks where short cues produce larger chunks and long cues produce smaller ones.
 *
 * Algorithm:
 * 1. Compute available tokens (safeInputBudget or contextWindow × contextUsageTarget)
 * 2. Subtract overheads (system prompt, schema, memory, context cues)
 * 3. Apply output reserve → inputCueBudget
 * 4. Apply maxOutputTokens × outputStabilityThreshold constraint
 * 5. targetTokenBudget = min(inputCueBudget, outputTokenBudget)
 * 6. maxCueCount from dynamicMaxChunkSize() as safety guardrail
 */
export function calculateAdaptiveChunkBudget(params: AdaptiveChunkParams): AdaptiveChunkBudget {
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
    safeInputBudget,
    hardChunkCeiling,
    outputStabilityThreshold = 0.85,
  } = params

  let maxCueCount = dynamicMaxChunkSize(totalCues)

  // Apply hard chunk ceiling if set
  if (hardChunkCeiling != null && hardChunkCeiling > 0) {
    maxCueCount = Math.min(maxCueCount, hardChunkCeiling)
  }

  const safeAvgCueTokens = Math.max(1, avgCueTokens)

  // 1. Total available tokens
  const availableTokens = (safeInputBudget != null && safeInputBudget > 0)
    ? safeInputBudget
    : (contextWindow ?? FALLBACK_CONTEXT_TOKENS) * contextUsageTarget

  // 2. Calculate overhead
  const schemaOverhead = outputStrategy === 'structured' ? STRUCTURED_SCHEMA_OVERHEAD : 0
  const contextCueTokens = (lookbehind + lookahead) * safeAvgCueTokens
  const totalOverhead = systemPromptOverhead + schemaOverhead + MEMORY_OVERHEAD + contextCueTokens

  // 3. Input cue budget (after reserving output space)
  const targetBudget = Math.max(0, availableTokens - totalOverhead)
  let inputCueBudget = targetBudget * (1 - DEFAULT_OUTPUT_RESERVE_RATIO)

  // 4. Apply maxOutputTokens constraint scaled by stability threshold
  if (maxOutputTokens && maxOutputTokens > 0) {
    const effectiveOutputBudget = maxOutputTokens * outputStabilityThreshold
    inputCueBudget = Math.min(inputCueBudget, effectiveOutputBudget)
  }

  // 5. Ensure a minimum budget (at least a few cues)
  const minTokenBudget = MIN_CHUNK_SIZE * safeAvgCueTokens
  const targetTokenBudget = Math.max(minTokenBudget, inputCueBudget)

  return {
    targetTokenBudget,
    maxCueCount,
    avgCueTokens: safeAvgCueTokens,
  }
}
