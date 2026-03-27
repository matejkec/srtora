import { z } from 'zod'
import { PipelinePhaseSchema } from './pipeline.js'

export const ErrorCodeSchema = z.enum([
  'PARSE_ERROR',
  'VALIDATION_ERROR',
  'PROVIDER_UNREACHABLE',
  'PROVIDER_AUTH_ERROR',
  'PROVIDER_RATE_LIMIT',
  'MODEL_NOT_FOUND',
  'STRUCTURED_OUTPUT_FAIL',
  'PIPELINE_ERROR',
  'CHUNK_FAILED',
  'CANCELLED',
  'INTEGRITY_ERROR',
])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

export const PipelineErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.string().optional(),
  recoverable: z.boolean().default(false),
  suggestion: z.string().optional(),
  phase: PipelinePhaseSchema.optional(),
  chunkId: z.string().optional(),
})
export type PipelineError = z.infer<typeof PipelineErrorSchema>

export class PipelineException extends Error {
  public readonly error: PipelineError

  constructor(error: PipelineError) {
    super(error.message)
    this.name = 'PipelineException'
    this.error = error
  }
}
