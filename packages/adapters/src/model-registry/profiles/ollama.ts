import type { ModelRegistryEntry } from '@srtora/types'
import { profile } from './openai.js'

/**
 * Ollama local model profiles — curated for subtitle translation.
 *
 * Key differences from cloud models:
 * - Use 'ollama-format' for structured output (Ollama handles JSON natively via format field)
 * - Lower retryBaseDelayMs (no rate limits)
 * - matchPatterns for runtime matching against discovered models
 * - ollamaFamily for family-level matching
 *
 * Curated set:
 * - TranslateGemma 4B / 12B (local-translation) — purpose-built translation models
 * - Gemma 3 4B / 12B (local-analysis) — local analysis and general tasks
 *
 * Gemma-family models do not support a separate system role.
 * TranslateGemma uses raw-completion (per-cue /v1/completions).
 *
 * Match patterns are provider-agnostic: they work for both Ollama native IDs
 * (e.g., "translategemma:4b") and MLX-style IDs served via openai-compatible
 * (e.g., "mlx-community/translategemma-4b-it-4bit" → normalized "translategemma-4b-it-4bit").
 */

// ── Helper for local profiles ──────────────────────────────────

const LOCAL_BASE = {
  retryBaseDelayMs: 200,  // local, no rate limits
} as const

// ── TranslateGemma (translation-specific) ──────────────────────

export const OLLAMA_MODELS: [string, ModelRegistryEntry][] = [
  ['translategemma:4b', {
    id: 'translategemma:4b',
    displayName: 'TranslateGemma 4B',
    provider: 'ollama',
    tier: 'supported',
    category: 'local-translation',
    description: 'Lightweight translation model. Fast, purpose-built for subtitle translation.',
    contextWindow: 8_192,
    maxOutputTokens: 4_096,
    ollamaFamily: 'translategemma',
    matchPatterns: ['^translategemma[:\\-_]?4b', 'translate[\\-_]gemma[\\-_]4b'],
    executionProfile: profile({
      structuredOutputMethod: 'none',
      promptStyleId: 'raw-completion',
      contextUsageMultiplier: 1.0,
      maxCompletionTokens: 4_096,
      supportsSystemRole: false,
      canAnalyze: false,
      canReview: false,
      translationOnly: true,
      reviewDepth: 'none',
      memoryInjection: 'none',
      defaultLookbehind: 2,
      defaultLookahead: 1,
      ...LOCAL_BASE,
    }),
  }],

  ['translategemma:12b', {
    id: 'translategemma:12b',
    displayName: 'TranslateGemma 12B',
    provider: 'ollama',
    tier: 'supported',
    category: 'local-translation',
    description: 'Higher quality translation. Better nuance and accuracy than 4B.',
    contextWindow: 8_192,
    maxOutputTokens: 4_096,
    ollamaFamily: 'translategemma',
    matchPatterns: ['^translategemma[:\\-_]?12b', 'translate.*gemma|gemma.*translate'],
    executionProfile: profile({
      structuredOutputMethod: 'none',
      promptStyleId: 'raw-completion',
      contextUsageMultiplier: 1.0,
      maxCompletionTokens: 4_096,
      supportsSystemRole: false,
      canAnalyze: false,
      canReview: false,
      translationOnly: true,
      reviewDepth: 'none',
      memoryInjection: 'none',
      defaultLookbehind: 2,
      defaultLookahead: 1,
      ...LOCAL_BASE,
    }),
  }],

  // ── Gemma 3 (local analysis) ────────────────────────────────────

  ['gemma3:4b', {
    id: 'gemma3:4b',
    displayName: 'Gemma 3 4B',
    provider: 'ollama',
    tier: 'supported',
    category: 'local-analysis',
    description: 'Lightweight local model for analysis and simple translations. 140+ languages.',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    ollamaFamily: 'gemma3',
    matchPatterns: ['^gemma[\\-_]?3[:\\-_]?4b'],
    executionProfile: profile({
      structuredOutputMethod: 'ollama-format',
      promptStyleId: 'no-system-role',
      contextUsageMultiplier: 0.5,
      maxCompletionTokens: 4_096,
      safeInputBudget: 16_000,
      supportsSystemRole: false,
      needsJsonReminder: true,
      reviewDepth: 'basic',
      memoryInjection: 'terms-only',
      defaultLookbehind: 2,
      defaultLookahead: 1,
      ...LOCAL_BASE,
    }),
  }],

  ['gemma3:12b', {
    id: 'gemma3:12b',
    displayName: 'Gemma 3 12B',
    provider: 'ollama',
    tier: 'supported',
    category: 'local-analysis',
    description: 'Mid-size local model. Better reasoning and translation quality than 4B.',
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    ollamaFamily: 'gemma3',
    matchPatterns: ['^gemma[\\-_]?3[:\\-_]?12b'],
    executionProfile: profile({
      structuredOutputMethod: 'ollama-format',
      promptStyleId: 'no-system-role',
      contextUsageMultiplier: 0.7,
      maxCompletionTokens: 8_192,
      safeInputBudget: 24_000,
      supportsSystemRole: false,
      needsJsonReminder: true,
      reviewDepth: 'basic',
      memoryInjection: 'terms-only',
      defaultLookbehind: 3,
      defaultLookahead: 2,
      ...LOCAL_BASE,
    }),
  }],
]
