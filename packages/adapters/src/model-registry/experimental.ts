import type { ExecutionProfile, ProviderType } from '@srtora/types'
import { profile } from './profiles/openai.js'

/**
 * Fallback execution profiles for unrecognized/experimental models.
 *
 * These provide conservative defaults per provider when a model is not
 * found in the registry. They prioritize safety over performance:
 * - Smaller chunks
 * - More conservative context usage
 * - JSON reminders enabled
 */

const EXPERIMENTAL_PROFILES: Record<ProviderType, ExecutionProfile> = {
  openai: profile({
    structuredOutputMethod: 'json-schema',
    promptStyleId: 'default',
    contextUsageMultiplier: 0.8,
    maxCompletionTokens: 4_096,
    retryBaseDelayMs: 1000,
  }),

  google: profile({
    structuredOutputMethod: 'prompted',  // conservative — not all Google models support json_schema
    promptStyleId: 'default',
    contextUsageMultiplier: 0.8,
    maxCompletionTokens: 4_096,
    retryBaseDelayMs: 1500,
    needsJsonReminder: true,
  }),

  anthropic: profile({
    structuredOutputMethod: 'prompted',
    promptStyleId: 'default',
    contextUsageMultiplier: 0.8,
    maxCompletionTokens: 4_096,
    retryBaseDelayMs: 2000,
    needsJsonReminder: true,
  }),

  ollama: profile({
    structuredOutputMethod: 'ollama-format',
    promptStyleId: 'default',
    contextUsageMultiplier: 0.6,  // very conservative for unknown local models
    maxCompletionTokens: 4_096,
    retryBaseDelayMs: 200,
    needsJsonReminder: true,
    memoryInjection: 'terms-only',
  }),

  'openai-compatible': profile({
    structuredOutputMethod: 'prompted',  // safest default for unknown servers
    promptStyleId: 'default',
    contextUsageMultiplier: 0.6,
    maxCompletionTokens: 4_096,
    retryBaseDelayMs: 500,
    needsJsonReminder: true,
  }),
}

/**
 * Get a conservative fallback execution profile for an experimental model.
 */
export function getExperimentalProfile(providerType: ProviderType): ExecutionProfile {
  return { ...EXPERIMENTAL_PROFILES[providerType] }
}

/**
 * Conservative capability defaults for experimental models per provider.
 * Used when the registry has no entry to provide context window / max output info.
 */
export const EXPERIMENTAL_CAPABILITIES: Record<ProviderType, { contextWindow: number; maxOutputTokens: number }> = {
  openai: { contextWindow: 128_000, maxOutputTokens: 16_384 },
  google: { contextWindow: 1_000_000, maxOutputTokens: 8_192 },
  anthropic: { contextWindow: 200_000, maxOutputTokens: 8_192 },
  ollama: { contextWindow: 4_096, maxOutputTokens: 2_048 },
  'openai-compatible': { contextWindow: 4_096, maxOutputTokens: 2_048 },
}
