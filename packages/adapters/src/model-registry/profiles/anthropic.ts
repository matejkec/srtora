import type { ModelRegistryEntry } from '@srtora/types'
import { profile } from './openai.js'

/**
 * Anthropic Claude model family profiles.
 *
 * Key difference from OpenAI/Google:
 * - No native JSON schema response_format
 * - Uses 'prompted' strategy: JSON instructions in prompt text, repair on parse
 * - Claude follows JSON instructions very reliably, so prompted works well
 * - tool_use workaround possible but adds complexity; prompted is sufficient
 *
 * Accessed via Anthropic's OpenAI-compatible endpoint.
 * Note: Anthropic requires a CORS proxy for direct browser use.
 *
 * Curated set: Claude Opus 4.6 (premium), Claude Sonnet 4.6 (balanced), Claude Haiku 4.5 (budget).
 */
export const ANTHROPIC_MODELS: [string, ModelRegistryEntry][] = [
  ['claude-opus-4-6', {
    id: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    provider: 'anthropic',
    tier: 'supported',
    category: 'premium',
    description: 'Most capable Claude. Best nuance, reasoning, and multilingual quality. 1M context.',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    executionProfile: profile({
      structuredOutputMethod: 'prompted',
      promptStyleId: 'default',
      contextUsageMultiplier: 1.3,
      maxCompletionTokens: 16_384,
      outputStabilityThreshold: 0.90,
      retryBaseDelayMs: 2000,
      needsJsonReminder: true,
      reviewDepth: 'thorough',
      defaultLookbehind: 5,
    }),
  }],

  ['claude-sonnet-4-6', {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    tier: 'supported',
    category: 'balanced',
    description: 'Best value Claude. Excellent quality with fast response times. 1M context.',
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    executionProfile: profile({
      structuredOutputMethod: 'prompted',
      promptStyleId: 'default',
      contextUsageMultiplier: 1.2,
      maxCompletionTokens: 16_384,
      outputStabilityThreshold: 0.85,
      retryBaseDelayMs: 2000,
      needsJsonReminder: true,
    }),
  }],

  ['claude-haiku-4-5', {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    provider: 'anthropic',
    tier: 'supported',
    category: 'budget',
    description: 'Fast and affordable Claude. Good quality with lower latency.',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    executionProfile: profile({
      structuredOutputMethod: 'prompted',
      promptStyleId: 'default',
      contextUsageMultiplier: 1.0,
      maxCompletionTokens: 8_192,
      outputStabilityThreshold: 0.80,
      retryBaseDelayMs: 2000,
      needsJsonReminder: true,
      memoryInjection: 'terms-only',
    }),
  }],
]
