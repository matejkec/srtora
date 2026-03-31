import { z } from 'zod'
import { ProviderConfigSchema } from './provider.js'
import { TranslationMemorySchema } from './memory.js'

export const PipelinePhaseSchema = z.enum([
  'idle',
  'parsing',
  'analyzing',
  'translating',
  'reviewing',
  'assembling',
  'complete',
  'error',
  'cancelled',
])
export type PipelinePhase = z.infer<typeof PipelinePhaseSchema>

export const ProgressEventSchema = z.object({
  phase: PipelinePhaseSchema,
  /** Overall progress 0-100 */
  percent: z.number().min(0).max(100),
  /** Current chunk index (during translation/review) */
  chunkIndex: z.number().int().nonnegative().optional(),
  /** Total chunks */
  totalChunks: z.number().int().positive().optional(),
  /** Elapsed milliseconds since pipeline start */
  elapsedMs: z.number().nonnegative(),
  /** Estimated milliseconds remaining */
  etaMs: z.number().nonnegative().optional(),
  /** Cumulative warning count */
  warningCount: z.number().int().nonnegative().default(0),
  /** Current status message */
  message: z.string().optional(),
})
export type ProgressEvent = z.infer<typeof ProgressEventSchema>

// ── Quality Mode ──────────────────────────────────────────────

export const QualityModeIdSchema = z.enum(['fast', 'balanced', 'high-quality', 'maximum'])
export type QualityModeId = z.infer<typeof QualityModeIdSchema>

export const QualityModeConfigSchema = z.object({
  id: QualityModeIdSchema,
  label: z.string(),
  description: z.string(),
  enableAnalysis: z.boolean(),
  enableReview: z.boolean(),
  reviewPasses: z.number().int().nonnegative(),
  chunkSizingStrategy: z.enum(['adaptive', 'fixed']),
  contextUsageTarget: z.number().min(0.1).max(1.0),
  lookbehind: z.number().int().nonnegative(),
  lookahead: z.number().int().nonnegative(),
  maxRetries: z.number().int().nonnegative(),
  enforceTerminology: z.boolean(),
  validateSpeakerConsistency: z.boolean(),
})
export type QualityModeConfig = z.infer<typeof QualityModeConfigSchema>

// ── Pipeline Config ───────────────────────────────────────────

export const PipelineConfigSchema = z.object({
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  provider: ProviderConfigSchema,
  translationModel: z.string(),
  analysisModel: z.string().optional(),
  reviewModel: z.string().optional(),
  enableAnalysis: z.boolean().optional(),
  enableReview: z.boolean().optional(),
  bilingualOutput: z.boolean().default(false),
  lookbehind: z.number().int().min(0).max(20).default(3),
  lookahead: z.number().int().min(0).max(20).default(3),
  tonePreference: z.string().optional(),
  maxRetries: z.number().int().min(0).max(5).default(2),
  /** Quality mode preset */
  qualityMode: QualityModeIdSchema.optional(),
  /** Number of review passes (overrides quality mode) */
  reviewPasses: z.number().int().min(0).max(5).optional(),
  /** Ollama family tag for model matching */
  ollamaFamily: z.string().optional(),
  /** Translation memory from previous sessions */
  translationMemory: TranslationMemorySchema.optional(),
})
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>
