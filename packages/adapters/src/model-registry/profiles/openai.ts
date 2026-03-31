import type { ModelRegistryEntry, ExecutionProfile } from '@srtora/types'

/**
 * Shorthand to create a fully specified ExecutionProfile with defaults.
 * Only requires the fields that differ from the base defaults.
 */
export function profile(overrides: Partial<ExecutionProfile> & Pick<ExecutionProfile, 'structuredOutputMethod' | 'promptStyleId'>): ExecutionProfile {
  return {
    contextUsageMultiplier: 1.0,
    maxCompletionTokens: null,
    temperature: null,
    retryTemperatureTier2: 0.3,
    retryTemperatureTier3: 0.5,
    maxRetries: null,
    retryBaseDelayMs: 1000,
    canAnalyze: true,
    canReview: true,
    canTranslate: true,
    supportsSystemRole: true,
    safeInputBudget: null,
    idealChunkTarget: null,
    hardChunkCeiling: null,
    outputStabilityThreshold: 0.85,
    defaultLookbehind: 3,
    defaultLookahead: 3,
    reviewDepth: 'basic',
    memoryInjection: 'full',
    translationOnly: false,
    needsJsonReminder: false,
    ...overrides,
  }
}

/**
 * OpenAI model profiles — curated for subtitle translation.
 *
 * All OpenAI models support:
 * - Native JSON schema via response_format
 * - System + user messages
 * - Large context windows (272K–1M)
 * - General reasoning (analysis, review, translation)
 *
 * Curated set: GPT-5.4 (premium), GPT-5.4 Mini (balanced).
 */
export const OPENAI_MODELS: [string, ModelRegistryEntry][] = [
  ['gpt-5.4', {
    id: 'gpt-5.4',
    displayName: 'GPT-5.4',
    provider: 'openai',
    tier: 'supported',
    category: 'premium',
    description: 'Latest OpenAI flagship. Best reasoning and translation quality.',
    contextWindow: 272_000,
    maxOutputTokens: 32_768,
    executionProfile: profile({
      structuredOutputMethod: 'json-schema',
      promptStyleId: 'default',
      contextUsageMultiplier: 1.2,
      maxCompletionTokens: 16_384,
      safeInputBudget: 200_000,
      outputStabilityThreshold: 0.9,
      retryBaseDelayMs: 1000,
      reviewDepth: 'thorough',
      defaultLookbehind: 5,
    }),
  }],

  ['gpt-5.4-mini', {
    id: 'gpt-5.4-mini',
    displayName: 'GPT-5.4 Mini',
    provider: 'openai',
    tier: 'supported',
    category: 'balanced',
    description: 'Best value OpenAI model. Fast, accurate, 1M context.',
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
    executionProfile: profile({
      structuredOutputMethod: 'json-schema',
      promptStyleId: 'default',
      contextUsageMultiplier: 1.3,
      maxCompletionTokens: 16_384,
      outputStabilityThreshold: 0.9,
      retryBaseDelayMs: 1000,
    }),
  }],
]
