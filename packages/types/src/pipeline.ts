import { z } from 'zod'
import { ProviderConfigSchema } from './provider.js'

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
  enableAnalysis: z.boolean().default(true),
  enableReview: z.boolean().default(true),
  bilingualOutput: z.boolean().default(false),
  chunkSize: z.number().int().min(4).max(50).default(15),
  lookbehind: z.number().int().min(0).max(10).default(3),
  lookahead: z.number().int().min(0).max(10).default(3),
  tonePreference: z.string().optional(),
  maxRetries: z.number().int().min(0).max(5).default(2),
})
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>
