import type { ModelRegistryEntry } from '@srtora/types'
import { profile } from './openai.js'

/**
 * Google Gemini model profiles — curated for subtitle translation.
 *
 * All Gemini models support:
 * - Native JSON schema via response_mime_type + response_json_schema
 * - System instructions
 * - 1,048,576 context window, 65,536 max output
 *
 * Accessed via Google's OpenAI-compatible endpoint.
 *
 * Curated set:
 * - Gemini 3.1 Pro Preview (premium) — newest flagship
 * - Gemini 3 Flash Preview (balanced) — fast and capable
 * - Gemini 3.1 Flash-Lite Preview (budget) — cost-effective
 * - Gemini 2.5 Flash (balanced) — stable production fallback
 */
export const GOOGLE_MODELS: [string, ModelRegistryEntry][] = [
  ['gemini-3.1-pro-preview', {
    id: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    provider: 'google',
    tier: 'supported',
    category: 'premium',
    description: 'Latest Gemini flagship. Best reasoning and multilingual quality.',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    executionProfile: profile({
      structuredOutputMethod: 'json-schema',
      promptStyleId: 'default',
      contextUsageMultiplier: 1.3,
      maxCompletionTokens: 16_384,
      outputStabilityThreshold: 0.85,
      retryBaseDelayMs: 1500,
      reviewDepth: 'thorough',
      defaultLookbehind: 5,
    }),
  }],

  ['gemini-3-flash-preview', {
    id: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash',
    provider: 'google',
    tier: 'supported',
    category: 'balanced',
    description: 'Fast and capable. Good balance of quality, speed, and cost.',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    executionProfile: profile({
      structuredOutputMethod: 'json-schema',
      promptStyleId: 'default',
      contextUsageMultiplier: 1.2,
      maxCompletionTokens: 16_384,
      outputStabilityThreshold: 0.85,
      retryBaseDelayMs: 1500,
    }),
  }],

  ['gemini-3.1-flash-lite-preview', {
    id: 'gemini-3.1-flash-lite-preview',
    displayName: 'Gemini 3.1 Flash-Lite',
    provider: 'google',
    tier: 'supported',
    category: 'budget',
    description: 'Budget Gemini. Good for high-volume simple translations.',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    executionProfile: profile({
      structuredOutputMethod: 'json-schema',
      promptStyleId: 'default',
      contextUsageMultiplier: 1.0,
      maxCompletionTokens: 8_192,
      outputStabilityThreshold: 0.80,
      retryBaseDelayMs: 1500,
    }),
  }],

  ['gemini-2.5-flash', {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    tier: 'supported',
    category: 'balanced',
    description: 'Stable production fallback. Proven reliability and free tier available.',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    executionProfile: profile({
      structuredOutputMethod: 'json-schema',
      promptStyleId: 'default',
      contextUsageMultiplier: 1.2,
      maxCompletionTokens: 16_384,
      outputStabilityThreshold: 0.85,
      retryBaseDelayMs: 1500,
    }),
  }],
]
