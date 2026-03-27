import { z } from 'zod'
import { ModelCapabilitiesSchema } from './capabilities.js'

export const ProviderTypeSchema = z.enum([
  'ollama',
  'openai-compatible',
  'openai',
  'anthropic',
  'google',
])
export type ProviderType = z.infer<typeof ProviderTypeSchema>

export const ExecutionModeSchema = z.enum(['local', 'cloud'])
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>

export const ProviderConfigSchema = z.object({
  type: ProviderTypeSchema,
  executionMode: ExecutionModeSchema,
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  label: z.string(),
})
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

export const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerId: ProviderTypeSchema,
  parameterSize: z.string().optional(),
  quantization: z.string().optional(),
  family: z.string().optional(),
  supportsStructuredOutput: z.boolean().default(true),
  supportsStreaming: z.boolean().default(true),
  contextLength: z.number().optional(),
  /** Rich capability profile. When absent, uses provider defaults. */
  capabilities: ModelCapabilitiesSchema.optional(),
})
export type ModelInfo = z.infer<typeof ModelInfoSchema>
