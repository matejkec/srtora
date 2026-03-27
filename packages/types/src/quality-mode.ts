import { z } from 'zod'

export const QualityModeIdSchema = z.enum([
  'fast',
  'balanced',
  'high-quality',
  'maximum',
])
export type QualityModeId = z.infer<typeof QualityModeIdSchema>

export const ChunkSizingStrategySchema = z.enum([
  /** Use the explicit chunkSize value */
  'fixed',
  /** Calculate from model context window */
  'adaptive',
])
export type ChunkSizingStrategy = z.infer<typeof ChunkSizingStrategySchema>

export const QualityModeConfigSchema = z.object({
  id: QualityModeIdSchema,
  label: z.string(),
  description: z.string(),
  enableAnalysis: z.boolean(),
  enableReview: z.boolean(),
  /** Number of review passes (0 = skip review entirely) */
  reviewPasses: z.number().int().min(0).max(3).default(1),
  chunkSizingStrategy: ChunkSizingStrategySchema.default('adaptive'),
  /** Only used if chunkSizingStrategy is 'fixed' */
  fixedChunkSize: z.number().int().min(4).max(50).optional(),
  /** Context window usage target: 0.0-1.0. Higher = larger chunks. */
  contextUsageTarget: z.number().min(0.2).max(0.9).default(0.6),
  lookbehind: z.number().int().min(0).max(10),
  lookahead: z.number().int().min(0).max(10),
  maxRetries: z.number().int().min(0).max(5),
  /** Whether to enforce terminology from memory */
  enforceTerminology: z.boolean().default(false),
  /** Whether to validate speaker consistency */
  validateSpeakerConsistency: z.boolean().default(false),
})
export type QualityModeConfig = z.infer<typeof QualityModeConfigSchema>
