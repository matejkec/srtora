import type {
  PipelineConfig,
  QualityModeConfig,
  ProviderType,
  ModelRegistryEntry,
  ExecutionProfile,
  StructuredOutputMethod,
  PromptStyleId,
  ModelSupportTier,
} from '@srtora/types'
import {
  resolveExecutionProfile,
  getModelCapabilities,
} from '@srtora/adapters'
import { QUALITY_MODES } from './quality-modes.js'

/**
 * Fully resolved execution parameters for a pipeline run.
 *
 * Merges three layers:
 * 1. ExecutionProfile (from model registry or experimental fallback)
 * 2. QualityModeConfig (user-selected quality mode)
 * 3. PipelineConfig (explicit user overrides)
 */
export interface ResolvedExecutionParams {
  // ── Chunk sizing ───────────────────────────────────────────

  /** Effective context usage target (quality mode × model multiplier, clamped) */
  effectiveContextUsageTarget: number
  /** Context window in tokens for adaptive chunk calculation */
  contextWindow: number
  /** Max output tokens for the model */
  maxOutputTokens: number
  /** Hard ceiling for max_tokens in requests */
  maxCompletionTokens: number
  /** Lookbehind cue count */
  lookbehind: number
  /** Lookahead cue count */
  lookahead: number

  // ── Token budgets ──────────────────────────────────────────

  /** Pre-calculated safe input budget. Null = derive from contextWindow × contextUsageTarget. */
  safeInputBudget: number | null
  /** Target cue count for best quality. Null = calculate adaptively. */
  idealChunkTarget: number | null
  /** Hard ceiling on cue count. Null = use dynamic max. */
  hardChunkCeiling: number | null
  /** Fraction of maxCompletionTokens to use (0-1). */
  outputStabilityThreshold: number

  // ── Output handling ────────────────────────────────────────

  /** How to request structured JSON output */
  structuredOutputMethod: StructuredOutputMethod
  /** Which prompt formatting strategy to use */
  promptStyleId: PromptStyleId

  // ── Retry ──────────────────────────────────────────────────

  /** Max retries for translation chunks */
  maxRetries: number
  /** Base temperature (null = omit / server default) */
  temperature: number | null
  /** Temperature for tier-2 retry */
  retryTemperatureTier2: number
  /** Temperature for tier-3 retry */
  retryTemperatureTier3: number
  /** Base delay between retries in ms */
  retryBaseDelayMs: number

  // ── Feature flags ──────────────────────────────────────────

  /** Whether analysis phase is enabled */
  enableAnalysis: boolean
  /** Whether review phase is enabled */
  enableReview: boolean
  /** Number of review passes */
  reviewPasses: number
  /** Review depth from model profile: 'none' = skip, 'basic' = single pass, 'thorough' = multi-pass */
  reviewDepth: 'none' | 'basic' | 'thorough'
  /** Memory injection strategy: 'full' = speakers + terms, 'terms-only' = terms only, 'none' = no memory */
  memoryInjection: 'full' | 'terms-only' | 'none'
  /** Whether model supports system role */
  supportsSystemRole: boolean
  /** Whether model is translation-only (no analysis/review) */
  translationOnly: boolean
  /** Whether to add explicit JSON reminder in prompts */
  needsJsonReminder: boolean

  // ── Model info ─────────────────────────────────────────────

  /** Model support tier */
  modelTier: ModelSupportTier
  /** Registry entry (null for experimental models) */
  registryEntry: ModelRegistryEntry | null
  /** The resolved execution profile used */
  executionProfile: ExecutionProfile
}

/**
 * Resolve the final execution parameters by merging:
 * 1. Model's execution profile (registry or experimental fallback)
 * 2. Quality mode config
 * 3. Explicit pipeline config overrides
 *
 * Priority: config > profile > quality mode > hardcoded defaults
 */
export function resolveExecutionParams(
  modelId: string,
  providerType: ProviderType,
  config: PipelineConfig,
  ollamaFamily?: string,
): ResolvedExecutionParams {
  // Resolve quality mode
  const mode: QualityModeConfig | undefined = config.qualityMode
    ? QUALITY_MODES[config.qualityMode]
    : undefined

  // Resolve execution profile from registry
  const { profile, entry } = resolveExecutionProfile(modelId, providerType, ollamaFamily)

  // Resolve model capabilities (context window, max output)
  const capabilities = getModelCapabilities(modelId, providerType, ollamaFamily)

  // ── Merge: context usage ─────────────────────────────────

  const baseContextTarget = mode?.contextUsageTarget ?? 0.6
  const effectiveContextUsageTarget = Math.min(
    0.9,
    Math.max(0.2, baseContextTarget * profile.contextUsageMultiplier),
  )

  // ── Merge: completion tokens ─────────────────────────────

  const maxCompletionTokens =
    profile.maxCompletionTokens ?? capabilities.maxOutputTokens ?? 4096

  // ── Merge: feature flags ─────────────────────────────────

  // If model is translation-only, force-disable analysis and review
  const canAnalyze = !profile.translationOnly && profile.canAnalyze
  const canReview = !profile.translationOnly && profile.canReview

  const enableAnalysis = config.enableAnalysis ?? (canAnalyze && (mode?.enableAnalysis ?? true))
  const enableReview = config.enableReview ?? (canReview && (mode?.enableReview ?? true))
  const reviewPasses = profile.translationOnly
    ? 0
    : (config.reviewPasses ?? mode?.reviewPasses ?? 1)

  // ── Merge: retries ───────────────────────────────────────

  const maxRetries = config.maxRetries ?? profile.maxRetries ?? mode?.maxRetries ?? 2

  // ── Merge: lookbehind/lookahead ──────────────────────────

  const lookbehind = config.lookbehind ?? mode?.lookbehind ?? profile.defaultLookbehind
  const lookahead = config.lookahead ?? mode?.lookahead ?? profile.defaultLookahead

  return {
    // Chunk sizing
    effectiveContextUsageTarget,
    contextWindow: capabilities.contextWindow,
    maxOutputTokens: capabilities.maxOutputTokens,
    maxCompletionTokens,
    lookbehind,
    lookahead,

    // Token budgets
    safeInputBudget: profile.safeInputBudget,
    idealChunkTarget: profile.idealChunkTarget,
    hardChunkCeiling: profile.hardChunkCeiling,
    outputStabilityThreshold: profile.outputStabilityThreshold,

    // Output handling
    structuredOutputMethod: profile.structuredOutputMethod,
    promptStyleId: profile.promptStyleId,

    // Retry
    maxRetries,
    temperature: profile.temperature,
    retryTemperatureTier2: profile.retryTemperatureTier2,
    retryTemperatureTier3: profile.retryTemperatureTier3,
    retryBaseDelayMs: profile.retryBaseDelayMs,

    // Feature flags
    enableAnalysis,
    enableReview,
    reviewPasses,
    reviewDepth: profile.translationOnly ? 'none' : profile.reviewDepth,
    memoryInjection: profile.memoryInjection,
    supportsSystemRole: profile.supportsSystemRole,
    translationOnly: profile.translationOnly,
    needsJsonReminder: profile.needsJsonReminder,

    // Model info
    modelTier: entry ? entry.tier : 'experimental',
    registryEntry: entry,
    executionProfile: profile,
  }
}
