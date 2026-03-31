import { describe, it, expect } from 'vitest'
import { resolveExecutionParams } from '../profile-resolver.js'
import type { PipelineConfig } from '@srtora/types'

// ── Helpers ──────────────────────────────────────────────────────

/** Minimal valid PipelineConfig for OpenAI provider. */
function minimalConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    sourceLanguage: 'en',
    targetLanguage: 'hr',
    provider: {
      type: 'openai',
      executionMode: 'cloud',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      label: 'OpenAI',
    },
    translationModel: 'gpt-5.4-mini',
    ...overrides,
  }
}

/** Minimal valid PipelineConfig for Ollama provider. */
function ollamaConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    sourceLanguage: 'en',
    targetLanguage: 'hr',
    provider: {
      type: 'ollama',
      executionMode: 'local',
      baseUrl: 'http://localhost:11434',
      label: 'Ollama',
    },
    translationModel: 'gemma3:4b',
    ...overrides,
  }
}

/** Minimal valid PipelineConfig for openai-compatible (Anthropic) provider. */
function anthropicCompatConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    sourceLanguage: 'en',
    targetLanguage: 'hr',
    provider: {
      type: 'openai-compatible',
      executionMode: 'cloud',
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'test-key',
      label: 'Anthropic',
    },
    translationModel: 'claude-sonnet-4-6',
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('resolveExecutionParams', () => {
  describe('basic resolution with a known model', () => {
    it('returns a valid ResolvedExecutionParams for gpt-5.4-mini', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      expect(result).toBeDefined()
      expect(result.modelTier).toBe('supported')
      expect(result.structuredOutputMethod).toBe('json-schema')
      expect(result.promptStyleId).toBe('default')
      expect(result.registryEntry).not.toBeNull()
      expect(result.contextWindow).toBeGreaterThan(0)
    })

    it('populates registry entry fields for a known model', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      expect(result.registryEntry).not.toBeNull()
      expect(result.registryEntry!.id).toBe('gpt-5.4-mini')
      expect(result.registryEntry!.provider).toBe('openai')
      expect(result.registryEntry!.displayName).toBe('GPT-5.4 Mini')
    })

    it('provides non-zero context window and max output tokens', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      expect(result.contextWindow).toBe(1_000_000)
      expect(result.maxOutputTokens).toBe(32_768)
      expect(result.maxCompletionTokens).toBe(16_384)
    })

    it('includes a complete execution profile', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      expect(result.executionProfile).toBeDefined()
      expect(result.executionProfile.structuredOutputMethod).toBe('json-schema')
      expect(result.executionProfile.promptStyleId).toBe('default')
      expect(result.executionProfile.contextUsageMultiplier).toBe(1.3)
    })

    it('defaults to system role support for OpenAI models', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      expect(result.supportsSystemRole).toBe(true)
      expect(result.translationOnly).toBe(false)
    })
  })

  describe('experimental model fallback', () => {
    it('returns experimental tier for an unknown model', () => {
      const result = resolveExecutionParams(
        'some-unknown-model',
        'openai',
        minimalConfig({ translationModel: 'some-unknown-model' }),
      )

      expect(result.modelTier).toBe('experimental')
      expect(result.registryEntry).toBeNull()
    })

    it('uses conservative defaults for unknown models', () => {
      const result = resolveExecutionParams(
        'some-unknown-model',
        'openai',
        minimalConfig({ translationModel: 'some-unknown-model' }),
      )

      // Experimental OpenAI profile has contextUsageMultiplier 0.8 (conservative)
      expect(result.executionProfile.contextUsageMultiplier).toBeLessThanOrEqual(1.0)
    })

    it('enables needsJsonReminder for unknown ollama models', () => {
      const result = resolveExecutionParams(
        'totally-unknown-local-model',
        'ollama',
        ollamaConfig({ translationModel: 'totally-unknown-local-model' }),
      )

      expect(result.modelTier).toBe('experimental')
      expect(result.registryEntry).toBeNull()
      expect(result.needsJsonReminder).toBe(true)
    })

    it('uses ollama-format for unknown ollama models', () => {
      const result = resolveExecutionParams(
        'totally-unknown-local-model',
        'ollama',
        ollamaConfig({ translationModel: 'totally-unknown-local-model' }),
      )

      expect(result.structuredOutputMethod).toBe('ollama-format')
    })

    it('uses prompted output for unknown openai-compatible models', () => {
      const result = resolveExecutionParams(
        'unknown-server-model',
        'openai-compatible',
        anthropicCompatConfig({ translationModel: 'unknown-server-model' }),
      )

      expect(result.modelTier).toBe('experimental')
      expect(result.structuredOutputMethod).toBe('prompted')
      expect(result.needsJsonReminder).toBe(true)
    })
  })

  describe('quality mode affects context usage target', () => {
    it('fast mode produces the maximum clamped context usage target', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'fast' }),
      )

      // fast contextUsageTarget = 0.8, gpt-5.4-mini multiplier = 1.3
      // effective = min(0.9, max(0.2, 0.8 * 1.3)) = min(0.9, 1.04) = 0.9
      expect(result.effectiveContextUsageTarget).toBe(0.9)
    })

    it('high-quality mode produces a lower context usage target', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'high-quality' }),
      )

      // high-quality contextUsageTarget = 0.5, gpt-5.4-mini multiplier = 1.3
      // effective = min(0.9, max(0.2, 0.5 * 1.3)) = 0.65
      expect(result.effectiveContextUsageTarget).toBeCloseTo(0.65, 2)
    })

    it('fast mode target is higher than high-quality mode target', () => {
      const fast = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'fast' }),
      )
      const highQuality = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'high-quality' }),
      )

      expect(fast.effectiveContextUsageTarget).toBeGreaterThan(
        highQuality.effectiveContextUsageTarget,
      )
    })

    it('maximum mode has the lowest context usage target', () => {
      const fast = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'fast' }),
      )
      const maximum = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'maximum' }),
      )

      // maximum: min(0.9, max(0.2, 0.4 * 1.3)) = 0.52
      expect(maximum.effectiveContextUsageTarget).toBeLessThan(
        fast.effectiveContextUsageTarget,
      )
      expect(maximum.effectiveContextUsageTarget).toBeCloseTo(0.52, 2)
    })

    it('all quality modes produce targets within the valid range', () => {
      const modes = ['fast', 'balanced', 'high-quality', 'maximum'] as const
      for (const mode of modes) {
        const result = resolveExecutionParams(
          'gpt-5.4-mini',
          'openai',
          minimalConfig({ qualityMode: mode }),
        )

        expect(
          result.effectiveContextUsageTarget,
          `${mode} mode target out of range`,
        ).toBeGreaterThanOrEqual(0.2)
        expect(
          result.effectiveContextUsageTarget,
          `${mode} mode target out of range`,
        ).toBeLessThanOrEqual(0.9)
      }
    })

    it('no quality mode uses the hardcoded default (0.6) as base', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(), // no qualityMode set
      )

      // Default base = 0.6, multiplier = 1.3 → min(0.9, max(0.2, 0.78)) = 0.78
      expect(result.effectiveContextUsageTarget).toBeCloseTo(0.78, 2)
    })
  })

  describe('config overrides take priority', () => {
    it('config enableAnalysis overrides profile and quality mode', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({
          qualityMode: 'balanced', // balanced enables analysis
          enableAnalysis: false,
        }),
      )

      expect(result.enableAnalysis).toBe(false)
    })

    it('config enableReview overrides profile and quality mode', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({
          qualityMode: 'balanced', // balanced enables review
          enableReview: false,
        }),
      )

      expect(result.enableReview).toBe(false)
    })

    it('config maxRetries overrides profile and quality mode', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({
          qualityMode: 'fast', // fast has maxRetries: 1
          maxRetries: 5,
        }),
      )

      expect(result.maxRetries).toBe(5)
    })

    it('config can force-enable analysis even when mode disables it', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({
          qualityMode: 'fast', // fast disables analysis
          enableAnalysis: true,
        }),
      )

      expect(result.enableAnalysis).toBe(true)
    })

    it('config can force-enable review even when mode disables it', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({
          qualityMode: 'fast', // fast disables review
          enableReview: true,
        }),
      )

      expect(result.enableReview).toBe(true)
    })

    it('config reviewPasses overrides quality mode default', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({
          qualityMode: 'balanced', // balanced has reviewPasses: 1
          reviewPasses: 3,
        }),
      )

      expect(result.reviewPasses).toBe(3)
    })

    it('combined overrides all apply simultaneously', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({
          qualityMode: 'balanced',
          enableAnalysis: false,
          enableReview: false,
          maxRetries: 5,
        }),
      )

      expect(result.enableAnalysis).toBe(false)
      expect(result.enableReview).toBe(false)
      expect(result.maxRetries).toBe(5)
    })
  })

  describe('translation-only model disables analysis/review', () => {
    it('translategemma:4b is identified as translation-only', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({
          translationModel: 'translategemma:4b',
          qualityMode: 'balanced', // balanced enables analysis/review
        }),
        'translategemma',
      )

      expect(result.translationOnly).toBe(true)
    })

    it('forces analysis off regardless of quality mode', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({
          translationModel: 'translategemma:4b',
          qualityMode: 'balanced',
        }),
        'translategemma',
      )

      expect(result.enableAnalysis).toBe(false)
    })

    it('forces review off regardless of quality mode', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({
          translationModel: 'translategemma:4b',
          qualityMode: 'balanced',
        }),
        'translategemma',
      )

      expect(result.enableReview).toBe(false)
    })

    it('forces reviewPasses to 0', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({
          translationModel: 'translategemma:4b',
          qualityMode: 'maximum', // maximum has reviewPasses: 3
        }),
        'translategemma',
      )

      expect(result.reviewPasses).toBe(0)
    })

    it('uses raw-completion prompt style', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({ translationModel: 'translategemma:4b' }),
        'translategemma',
      )

      expect(result.promptStyleId).toBe('raw-completion')
    })

    it('uses none for structured output (raw text)', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({ translationModel: 'translategemma:4b' }),
        'translategemma',
      )

      expect(result.structuredOutputMethod).toBe('none')
    })

    it('disables system role', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({ translationModel: 'translategemma:4b' }),
        'translategemma',
      )

      expect(result.supportsSystemRole).toBe(false)
    })

    it('forces reviewDepth to none', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({ translationModel: 'translategemma:4b' }),
        'translategemma',
      )

      expect(result.reviewDepth).toBe('none')
    })

    it('uses none for memoryInjection', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({ translationModel: 'translategemma:4b' }),
        'translategemma',
      )

      expect(result.memoryInjection).toBe('none')
    })

    it('config enableAnalysis: true still resolves to true (explicit config override)', () => {
      // When profile.canAnalyze is false and translationOnly is true,
      // canAnalyze is false. But config.enableAnalysis is checked first:
      // config.enableAnalysis ?? (canAnalyze && mode) → true is explicit override.
      // The resolver respects explicit config — user can force it on.
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({
          translationModel: 'translategemma:4b',
          enableAnalysis: true,
        }),
        'translategemma',
      )

      // Config override takes highest priority, so explicit true wins.
      // The model may fail at analysis, but the resolver respects the config.
      expect(result.enableAnalysis).toBe(true)
    })
  })

  describe('lookbehind/lookahead from quality mode and profile defaults', () => {
    it('fast mode sets lookbehind: 2 and lookahead: 1', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'fast' }),
      )

      expect(result.lookbehind).toBe(2)
      expect(result.lookahead).toBe(1)
    })

    it('balanced mode sets lookbehind: 3 and lookahead: 3', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'balanced' }),
      )

      expect(result.lookbehind).toBe(3)
      expect(result.lookahead).toBe(3)
    })

    it('high-quality mode sets lookbehind: 5 and lookahead: 5', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'high-quality' }),
      )

      expect(result.lookbehind).toBe(5)
      expect(result.lookahead).toBe(5)
    })

    it('maximum mode sets lookbehind: 7 and lookahead: 5', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'maximum' }),
      )

      expect(result.lookbehind).toBe(7)
      expect(result.lookahead).toBe(5)
    })

    it('config lookbehind overrides quality mode', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({
          qualityMode: 'fast', // fast has lookbehind: 2
          lookbehind: 10,
        }),
      )

      expect(result.lookbehind).toBe(10)
    })

    it('config lookahead overrides quality mode', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({
          qualityMode: 'fast', // fast has lookahead: 1
          lookahead: 8,
        }),
      )

      expect(result.lookahead).toBe(8)
    })

    it('falls back to profile defaultLookbehind/defaultLookahead when no quality mode (gpt-5.4-mini)', () => {
      // gpt-5.4-mini profile defaults: defaultLookbehind: 3, defaultLookahead: 3
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(), // no qualityMode
      )

      expect(result.lookbehind).toBe(3)
      expect(result.lookahead).toBe(3)
    })

    it('falls back to profile defaultLookbehind/defaultLookahead when no quality mode (gemma3:4b)', () => {
      // gemma3:4b profile: defaultLookbehind: 2, defaultLookahead: 1
      const result = resolveExecutionParams(
        'gemma3:4b',
        'ollama',
        ollamaConfig(), // no qualityMode
        'gemma3',
      )

      expect(result.lookbehind).toBe(2)
      expect(result.lookahead).toBe(1)
    })

    it('quality mode lookbehind takes priority over profile defaultLookbehind', () => {
      // gemma3:4b has defaultLookbehind: 2, but balanced mode has lookbehind: 3
      const result = resolveExecutionParams(
        'gemma3:4b',
        'ollama',
        ollamaConfig({ qualityMode: 'balanced' }),
        'gemma3',
      )

      expect(result.lookbehind).toBe(3)
      expect(result.lookahead).toBe(3)
    })
  })

  describe('Ollama model resolution', () => {
    it('resolves gemma3:4b as a supported ollama model', () => {
      const result = resolveExecutionParams(
        'gemma3:4b',
        'ollama',
        ollamaConfig(),
        'gemma3',
      )

      expect(result.modelTier).toBe('supported')
      expect(result.structuredOutputMethod).toBe('ollama-format')
    })

    it('populates registry entry for gemma3:4b', () => {
      const result = resolveExecutionParams(
        'gemma3:4b',
        'ollama',
        ollamaConfig(),
        'gemma3',
      )

      expect(result.registryEntry).not.toBeNull()
      expect(result.registryEntry!.id).toBe('gemma3:4b')
      expect(result.registryEntry!.provider).toBe('ollama')
    })

    it('uses low retry delay for local models', () => {
      const result = resolveExecutionParams(
        'gemma3:4b',
        'ollama',
        ollamaConfig(),
        'gemma3',
      )

      // Ollama models use retryBaseDelayMs: 200 (no rate limits)
      expect(result.retryBaseDelayMs).toBe(200)
    })

    it('provides correct context window and token limits for gemma3:4b', () => {
      const result = resolveExecutionParams(
        'gemma3:4b',
        'ollama',
        ollamaConfig(),
        'gemma3',
      )

      expect(result.contextWindow).toBe(128_000)
      expect(result.maxOutputTokens).toBe(8_192)
      expect(result.maxCompletionTokens).toBe(4_096)
      expect(result.safeInputBudget).toBe(16_000)
    })

    it('Gemma models disable system role', () => {
      const result = resolveExecutionParams(
        'gemma3:4b',
        'ollama',
        ollamaConfig(),
        'gemma3',
      )

      expect(result.supportsSystemRole).toBe(false)
      expect(result.promptStyleId).toBe('no-system-role')
      expect(result.needsJsonReminder).toBe(true)
    })

    it('resolves unknown ollama model as experimental', () => {
      const result = resolveExecutionParams(
        'unknown-local:7b',
        'ollama',
        ollamaConfig({ translationModel: 'unknown-local:7b' }),
      )

      expect(result.modelTier).toBe('experimental')
      expect(result.registryEntry).toBeNull()
      expect(result.structuredOutputMethod).toBe('ollama-format')
    })
  })

  describe('Anthropic model via openai-compatible', () => {
    it('resolves claude-sonnet-4-6 as a supported model', () => {
      const result = resolveExecutionParams(
        'claude-sonnet-4-6',
        'openai-compatible',
        anthropicCompatConfig(),
      )

      // Matcher finds registry entry via non-provider-strict fallback
      expect(result.registryEntry).not.toBeNull()
      expect(result.modelTier).toBe('supported')
    })

    it('has balanced category', () => {
      const result = resolveExecutionParams(
        'claude-sonnet-4-6',
        'openai-compatible',
        anthropicCompatConfig(),
      )

      expect(result.registryEntry).not.toBeNull()
      expect(result.registryEntry!.category).toBe('balanced')
    })

    it('uses prompted structured output method', () => {
      const result = resolveExecutionParams(
        'claude-sonnet-4-6',
        'openai-compatible',
        anthropicCompatConfig(),
      )

      expect(result.structuredOutputMethod).toBe('prompted')
    })

    it('enables JSON reminder for prompted mode', () => {
      const result = resolveExecutionParams(
        'claude-sonnet-4-6',
        'openai-compatible',
        anthropicCompatConfig(),
      )

      expect(result.needsJsonReminder).toBe(true)
    })

    it('uses higher retry delay for cloud provider', () => {
      const result = resolveExecutionParams(
        'claude-sonnet-4-6',
        'openai-compatible',
        anthropicCompatConfig(),
      )

      // Anthropic profile uses retryBaseDelayMs: 2000
      expect(result.retryBaseDelayMs).toBe(2000)
    })

    it('supports system role for Claude models', () => {
      const result = resolveExecutionParams(
        'claude-sonnet-4-6',
        'openai-compatible',
        anthropicCompatConfig(),
      )

      expect(result.supportsSystemRole).toBe(true)
    })
  })

  describe('retry parameters', () => {
    it('inherits retry temperatures from execution profile', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      expect(result.retryTemperatureTier2).toBe(0.3)
      expect(result.retryTemperatureTier3).toBe(0.5)
    })

    it('maxRetries falls through quality mode when profile has null', () => {
      // gpt-5.4-mini profile has maxRetries: null
      // balanced mode has maxRetries: 2
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'balanced' }),
      )

      expect(result.maxRetries).toBe(2)
    })

    it('maxRetries defaults to 2 when no quality mode and profile is null', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(), // no qualityMode, profile maxRetries is null
      )

      expect(result.maxRetries).toBe(2)
    })

    it('temperature from profile is preserved', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      // Default profile temperature is null (server default)
      expect(result.temperature).toBeNull()
    })

    it('retryBaseDelayMs from profile is preserved', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      expect(result.retryBaseDelayMs).toBe(1000)
    })
  })

  describe('quality mode feature flags', () => {
    it('fast mode disables analysis and review', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'fast' }),
      )

      expect(result.enableAnalysis).toBe(false)
      expect(result.enableReview).toBe(false)
      expect(result.reviewPasses).toBe(0)
    })

    it('balanced mode enables analysis and single-pass review', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'balanced' }),
      )

      expect(result.enableAnalysis).toBe(true)
      expect(result.enableReview).toBe(true)
      expect(result.reviewPasses).toBe(1)
    })

    it('high-quality mode enables multi-pass review', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'high-quality' }),
      )

      expect(result.enableAnalysis).toBe(true)
      expect(result.enableReview).toBe(true)
      expect(result.reviewPasses).toBe(2)
    })

    it('maximum mode enables 3-pass review', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'maximum' }),
      )

      expect(result.enableAnalysis).toBe(true)
      expect(result.enableReview).toBe(true)
      expect(result.reviewPasses).toBe(3)
    })
  })

  describe('reviewDepth and memoryInjection from profile', () => {
    it('passes through reviewDepth from model profile (gpt-5.4-mini defaults to basic)', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      // gpt-5.4-mini inherits default reviewDepth: 'basic'
      expect(result.reviewDepth).toBe('basic')
    })

    it('passes through reviewDepth from model profile (gpt-5.4 has thorough)', () => {
      const result = resolveExecutionParams(
        'gpt-5.4',
        'openai',
        minimalConfig({ translationModel: 'gpt-5.4' }),
      )

      // gpt-5.4 has explicit reviewDepth: 'thorough'
      expect(result.reviewDepth).toBe('thorough')
    })

    it('passes through reviewDepth from model profile (gemma3:4b has basic)', () => {
      const result = resolveExecutionParams(
        'gemma3:4b',
        'ollama',
        ollamaConfig(),
        'gemma3',
      )

      expect(result.reviewDepth).toBe('basic')
    })

    it('forces reviewDepth to none for translation-only models', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({ translationModel: 'translategemma:4b' }),
        'translategemma',
      )

      // Profile has reviewDepth: 'none' and resolver enforces 'none' for translationOnly
      expect(result.reviewDepth).toBe('none')
    })

    it('passes through memoryInjection from model profile (gpt-5.4-mini defaults to full)', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      // gpt-5.4-mini inherits default memoryInjection: 'full'
      expect(result.memoryInjection).toBe('full')
    })

    it('passes through memoryInjection from model profile (gemma3:4b has terms-only)', () => {
      const result = resolveExecutionParams(
        'gemma3:4b',
        'ollama',
        ollamaConfig(),
        'gemma3',
      )

      // gemma3:4b has explicit memoryInjection: 'terms-only'
      expect(result.memoryInjection).toBe('terms-only')
    })

    it('passes through memoryInjection from model profile (translategemma:4b has none)', () => {
      const result = resolveExecutionParams(
        'translategemma:4b',
        'ollama',
        ollamaConfig({ translationModel: 'translategemma:4b' }),
        'translategemma',
      )

      expect(result.memoryInjection).toBe('none')
    })
  })

  describe('edge cases', () => {
    it('different OpenAI models resolve with different context usage multipliers', () => {
      const premium = resolveExecutionParams(
        'gpt-5.4',
        'openai',
        minimalConfig({
          translationModel: 'gpt-5.4',
          qualityMode: 'balanced',
        }),
      )
      const balanced = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'balanced' }),
      )

      // gpt-5.4 has multiplier 1.2, gpt-5.4-mini has multiplier 1.3
      // With balanced contextUsageTarget 0.6:
      // gpt-5.4:      min(0.9, max(0.2, 0.6 * 1.2)) = 0.72
      // gpt-5.4-mini: min(0.9, max(0.2, 0.6 * 1.3)) = 0.78
      expect(balanced.effectiveContextUsageTarget).toBeGreaterThan(
        premium.effectiveContextUsageTarget,
      )
      expect(premium.effectiveContextUsageTarget).toBeCloseTo(0.72, 2)
      expect(balanced.effectiveContextUsageTarget).toBeCloseTo(0.78, 2)
    })

    it('clamping prevents context usage target from exceeding 0.9', () => {
      // gpt-5.4-mini has multiplier 1.3, fast has target 0.8 → 0.8 * 1.3 = 1.04 → clamped to 0.9
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'fast' }),
      )

      expect(result.effectiveContextUsageTarget).toBe(0.9)
    })

    it('clamping prevents context usage target from going below 0.2', () => {
      // Experimental ollama multiplier is 0.6, maximum target is 0.4
      // 0.4 * 0.6 = 0.24 — still above 0.2 but close to the floor
      const result = resolveExecutionParams(
        'some-unknown-ollama',
        'ollama',
        ollamaConfig({
          translationModel: 'some-unknown-ollama',
          qualityMode: 'maximum',
        }),
      )

      expect(result.effectiveContextUsageTarget).toBeGreaterThanOrEqual(0.2)
      expect(result.effectiveContextUsageTarget).toBeLessThanOrEqual(0.9)
    })

    it('outputStabilityThreshold from profile is preserved', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig(),
      )

      expect(result.outputStabilityThreshold).toBe(0.9)
    })

    it('all return fields are populated (no undefined values)', () => {
      const result = resolveExecutionParams(
        'gpt-5.4-mini',
        'openai',
        minimalConfig({ qualityMode: 'balanced' }),
      )

      expect(result.effectiveContextUsageTarget).toBeDefined()
      expect(result.contextWindow).toBeDefined()
      expect(result.maxOutputTokens).toBeDefined()
      expect(result.maxCompletionTokens).toBeDefined()
      expect(result.lookbehind).toBeDefined()
      expect(result.lookahead).toBeDefined()
      expect(result.structuredOutputMethod).toBeDefined()
      expect(result.promptStyleId).toBeDefined()
      expect(result.maxRetries).toBeDefined()
      expect(typeof result.temperature === 'number' || result.temperature === null).toBe(true)
      expect(result.retryTemperatureTier2).toBeDefined()
      expect(result.retryTemperatureTier3).toBeDefined()
      expect(result.retryBaseDelayMs).toBeDefined()
      expect(typeof result.enableAnalysis).toBe('boolean')
      expect(typeof result.enableReview).toBe('boolean')
      expect(typeof result.reviewPasses).toBe('number')
      expect(typeof result.supportsSystemRole).toBe('boolean')
      expect(typeof result.translationOnly).toBe('boolean')
      expect(typeof result.needsJsonReminder).toBe('boolean')
      expect(result.modelTier).toBeDefined()
      expect(result.executionProfile).toBeDefined()
      expect(result.reviewDepth).toBeDefined()
      expect(['none', 'basic', 'thorough']).toContain(result.reviewDepth)
      expect(result.memoryInjection).toBeDefined()
      expect(['full', 'terms-only', 'none']).toContain(result.memoryInjection)
    })
  })
})
