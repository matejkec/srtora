import { z } from 'zod'
import { ProviderConfigSchema } from './provider.js'
import { QualityModeIdSchema } from './quality-mode.js'
import { OutputStrategyTypeSchema, ResolvedCapabilitiesSchema } from './capabilities.js'
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

export const PipelineConfigSchema = z.object({
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  provider: ProviderConfigSchema,
  translationModel: z.string(),
  analysisModel: z.string().optional(),
  reviewModel: z.string().optional(),
  enableAnalysis: z.boolean().optional(),
  enableReview: z.boolean().optional(),
  bilingualOutput: z.boolean().optional(),
  chunkSize: z.number().int().min(4).max(50).optional(),
  lookbehind: z.number().int().min(0).max(10).optional(),
  lookahead: z.number().int().min(0).max(10).optional(),
  tonePreference: z.string().optional(),
  maxRetries: z.number().int().min(0).max(5).optional(),
  /** Quality mode — when set, overrides analysis/review/chunking defaults */
  qualityMode: QualityModeIdSchema.optional(),
  /** Override output strategy. Null = auto-detect from model capabilities. */
  outputStrategy: OutputStrategyTypeSchema.optional(),
  /** Translation memory to inject into prompts */
  translationMemory: TranslationMemorySchema.optional(),
  /** Resolved model capabilities (injected by orchestrator setup) */
  modelCapabilities: ResolvedCapabilitiesSchema.optional(),
  /** Number of review passes (overrides quality mode default) */
  reviewPasses: z.number().int().min(0).max(3).optional(),
})
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>
