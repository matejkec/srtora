import { z } from 'zod'
import { ProviderTypeSchema } from './provider.js'

// ── Support Tiers ──────────────────────────────────────────────

export const ModelSupportTierSchema = z.enum([
  /** First-class: individually tuned execution profile, tested */
  'supported',
  /** Detected at runtime, conservative defaults, may not work well */
  'experimental',
])
export type ModelSupportTier = z.infer<typeof ModelSupportTierSchema>

// ── UI Categories ──────────────────────────────────────────────

export const ModelCategorySchema = z.enum([
  /** Best quality, highest cost or slowest */
  'premium',
  /** Best quality/speed/cost tradeoff */
  'balanced',
  /** Cheapest cloud option */
  'budget',
  /** Local models specialized for translation (e.g. TranslateGemma) */
  'local-translation',
  /** Local models for analysis and general tasks */
  'local-analysis',
])
export type ModelCategory = z.infer<typeof ModelCategorySchema>

// ── Prompt Style ───────────────────────────────────────────────

export const PromptStyleIdSchema = z.enum([
  /** System + user messages (most models) */
  'default',
  /** Single user message merging system into user (Gemma, models without system role) */
  'no-system-role',
  /** Raw /v1/completions API, not chat (TranslateGemma) */
  'raw-completion',
])
export type PromptStyleId = z.infer<typeof PromptStyleIdSchema>

// ── Structured Output Method ───────────────────────────────────

export const StructuredOutputMethodSchema = z.enum([
  /** OpenAI response_format.json_schema */
  'json-schema',
  /** Ollama native format field */
  'ollama-format',
  /** JSON instructions injected into prompt text, repair on parse */
  'prompted',
  /** No JSON handling (raw text output) */
  'none',
])
export type StructuredOutputMethod = z.infer<typeof StructuredOutputMethodSchema>

// ── Execution Profile ──────────────────────────────────────────

export const ExecutionProfileSchema = z.object({
  // --- Output handling ---
  /** How to request structured JSON from this model */
  structuredOutputMethod: StructuredOutputMethodSchema,
  /** Which prompt formatting strategy to use */
  promptStyleId: PromptStyleIdSchema,

  // --- Chunk sizing ---
  /** Multiplier applied to quality mode's contextUsageTarget. >1.0 = bigger chunks. */
  contextUsageMultiplier: z.number().min(0.3).max(2.0).default(1.0),
  /** Hard ceiling for max_tokens / num_predict in requests. Null = derive from model maxOutputTokens. */
  maxCompletionTokens: z.number().int().positive().nullable().default(null),

  // --- Retry tuning ---
  /** Base temperature for normal requests. Null = omit (use server default). */
  temperature: z.number().min(0).max(2).nullable().default(null),
  /** Temperature for tier-2 retry (introduce variation). */
  retryTemperatureTier2: z.number().min(0).max(2).default(0.3),
  /** Temperature for tier-3 retry (simplified prompt). */
  retryTemperatureTier3: z.number().min(0).max(2).default(0.5),
  /** Max retries override. Null = use quality mode default. */
  maxRetries: z.number().int().min(0).max(5).nullable().default(null),
  /** Base delay between retries in ms. Lower for local (no rate limits). */
  retryBaseDelayMs: z.number().int().nonnegative().default(1000),

  // --- Feature flags ---
  /** Whether this model can handle analysis prompts (general reasoning). */
  canAnalyze: z.boolean().default(true),
  /** Whether this model can handle review prompts. */
  canReview: z.boolean().default(true),
  /** Whether this model can handle translation prompts. */
  canTranslate: z.boolean().default(true),
  /** Whether model supports system role messages. */
  supportsSystemRole: z.boolean().default(true),

  // --- Token budgets ---
  /** Pre-calculated safe input token budget. Null = derive from contextWindow × contextUsageTarget. */
  safeInputBudget: z.number().int().positive().nullable().default(null),
  /** Target cue count for best quality. Null = calculate adaptively from context window. */
  idealChunkTarget: z.number().int().positive().nullable().default(null),
  /** Never exceed this cue count regardless of model capacity. Null = use dynamic max (50/75/100 based on file size). */
  hardChunkCeiling: z.number().int().positive().nullable().default(null),
  /** Fraction of maxCompletionTokens to actually use (0-1). Models that degrade at high output should use lower values. */
  outputStabilityThreshold: z.number().min(0.1).max(1.0).default(0.85),

  // --- Per-model defaults ---
  /** Default lookbehind cue count (context-before). Overridden by quality mode or user config. */
  defaultLookbehind: z.number().int().min(0).max(10).default(3),
  /** Default lookahead cue count (context-after). Overridden by quality mode or user config. */
  defaultLookahead: z.number().int().min(0).max(10).default(3),
  /** Review phase depth: 'none' = skip, 'basic' = single pass, 'thorough' = multi-pass. */
  reviewDepth: z.enum(['none', 'basic', 'thorough']).default('basic'),
  /** Session memory injection strategy for translation prompts. */
  memoryInjection: z.enum(['full', 'terms-only', 'none']).default('full'),

  // --- Quirks ---
  /** Model is a dedicated translation model (no analysis/review). */
  translationOnly: z.boolean().default(false),
  /** Model works better with explicit "respond with ONLY valid JSON" reminder. */
  needsJsonReminder: z.boolean().default(false),
})
export type ExecutionProfile = z.infer<typeof ExecutionProfileSchema>

// ── Model Registry Entry ───────────────────────────────────────

export const ModelRegistryEntrySchema = z.object({
  /** Canonical model ID used for exact matching (e.g., 'gpt-5.4-mini') */
  id: z.string(),
  /** Human-readable display name */
  displayName: z.string(),
  /** Provider this model belongs to */
  provider: ProviderTypeSchema,
  /** Support tier */
  tier: ModelSupportTierSchema,
  /** UI category for grouping */
  category: ModelCategorySchema,
  /** Short description for UI tooltip */
  description: z.string().optional(),

  // --- Capabilities ---
  /** Context window in tokens */
  contextWindow: z.number().int().positive(),
  /** Max output tokens */
  maxOutputTokens: z.number().int().positive(),

  // --- Execution ---
  /** Per-model tuned execution parameters */
  executionProfile: ExecutionProfileSchema,

  // --- Runtime matching (for Ollama discovered models) ---
  /** Regex patterns to match runtime-discovered model IDs to this entry */
  matchPatterns: z.array(z.string()).optional(),
  /** Ollama model family tag for matching (e.g., 'qwen2.5', 'gemma3') */
  ollamaFamily: z.string().optional(),
})
export type ModelRegistryEntry = z.infer<typeof ModelRegistryEntrySchema>

// ── Match Result ───────────────────────────────────────────────

export const MatchTypeSchema = z.enum(['exact', 'family', 'pattern'])
export type MatchType = z.infer<typeof MatchTypeSchema>

export const ModelMatchResultSchema = z.object({
  entry: ModelRegistryEntrySchema,
  tier: ModelSupportTierSchema,
  matchType: MatchTypeSchema,
})
export type ModelMatchResult = z.infer<typeof ModelMatchResultSchema>
