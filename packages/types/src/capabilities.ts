import { z } from 'zod'

export const OutputStrategyTypeSchema = z.enum([
  /** JSON schema enforcement via API (response_format / format field) */
  'structured',
  /** JSON instructions in prompt text, repair on parse */
  'prompted',
  /** Raw text completion (TranslateGemma-like models) */
  'raw',
])
export type OutputStrategyType = z.infer<typeof OutputStrategyTypeSchema>

export const ModelCapabilitiesSchema = z.object({
  /** Model supports JSON schema via response_format / format field */
  supportsStructuredOutput: z.boolean().default(false),
  /** Model supports system role messages */
  supportsSystemRole: z.boolean().default(true),
  /** Context window in tokens. Null = unknown. */
  contextWindow: z.number().int().positive().nullable().default(null),
  /** Max output tokens. Null = unknown (use safe default). */
  maxOutputTokens: z.number().int().positive().nullable().default(null),
  /** Whether the model can be used for analysis/review (general reasoning) */
  supportsGeneralReasoning: z.boolean().default(true),
  /** Provider-specific quirks */
  quirks: z
    .object({
      /** Model needs content arrays flattened (MLX TranslateGemma) */
      requiresFlattenedContent: z.boolean().default(false),
      /** Model is a dedicated translation model (no analysis/review) */
      translationOnly: z.boolean().default(false),
    })
    .default({}),
})
export type ModelCapabilities = z.infer<typeof ModelCapabilitiesSchema>

export const CapabilitySourceSchema = z.enum([
  /** Matched a known model profile in the registry */
  'registry',
  /** Inferred from provider type */
  'provider-default',
  /** Detected at runtime via trial request */
  'probed',
  /** Manually configured by user */
  'user-override',
])
export type CapabilitySource = z.infer<typeof CapabilitySourceSchema>

export const ResolvedCapabilitiesSchema = z.object({
  capabilities: ModelCapabilitiesSchema,
  outputStrategy: OutputStrategyTypeSchema,
  source: CapabilitySourceSchema,
})
export type ResolvedCapabilities = z.infer<typeof ResolvedCapabilitiesSchema>
