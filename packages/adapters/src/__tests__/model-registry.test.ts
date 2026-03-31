import { describe, it, expect } from 'vitest'
import {
  getRegistryEntry,
  resolveExecutionProfile,
  getModelCapabilities,
  listSupportedModels,
  listSupportedModelsGrouped,
  matchDetectedModels,
} from '../model-registry/index.js'
import type { ModelInfo } from '@srtora/types'

// ── Cloud Model Exact Matching ──────────────────────────────────

describe('getRegistryEntry — cloud models', () => {
  // ── OpenAI ──────────────────────────────────────────────────

  const openaiModels = [
    { id: 'gpt-5.4', displayName: 'GPT-5.4', category: 'premium' },
    { id: 'gpt-5.4-mini', displayName: 'GPT-5.4 Mini', category: 'balanced' },
  ] as const

  it.each(openaiModels)('finds $id by exact match', ({ id, displayName, category }) => {
    const entry = getRegistryEntry(id, 'openai')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe(id)
    expect(entry!.displayName).toBe(displayName)
    expect(entry!.provider).toBe('openai')
    expect(entry!.tier).toBe('supported')
    expect(entry!.category).toBe(category)
  })

  // ── Google ──────────────────────────────────────────────────

  const googleModels = [
    { id: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro', category: 'premium' },
    { id: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash', category: 'balanced' },
    { id: 'gemini-3.1-flash-lite-preview', displayName: 'Gemini 3.1 Flash-Lite', category: 'budget' },
    { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', category: 'balanced' },
  ] as const

  it.each(googleModels)('finds $id by exact match', ({ id, displayName, category }) => {
    const entry = getRegistryEntry(id, 'google')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe(id)
    expect(entry!.displayName).toBe(displayName)
    expect(entry!.provider).toBe('google')
    expect(entry!.tier).toBe('supported')
    expect(entry!.category).toBe(category)
  })

  // ── Anthropic ───────────────────────────────────────────────

  const anthropicModels = [
    { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', category: 'premium' },
    { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', category: 'balanced' },
    { id: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', category: 'budget' },
  ] as const

  it.each(anthropicModels)('finds $id by exact match', ({ id, displayName, category }) => {
    const entry = getRegistryEntry(id, 'anthropic')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe(id)
    expect(entry!.displayName).toBe(displayName)
    expect(entry!.provider).toBe('anthropic')
    expect(entry!.tier).toBe('supported')
    expect(entry!.category).toBe(category)
  })
})

// ── Ollama Exact Match ──────────────────────────────────────────

describe('getRegistryEntry — Ollama exact match', () => {
  const ollamaModels = [
    { id: 'translategemma:4b', displayName: 'TranslateGemma 4B', family: 'translategemma' },
    { id: 'translategemma:12b', displayName: 'TranslateGemma 12B', family: 'translategemma' },
    { id: 'gemma3:4b', displayName: 'Gemma 3 4B', family: 'gemma3' },
    { id: 'gemma3:12b', displayName: 'Gemma 3 12B', family: 'gemma3' },
  ] as const

  it.each(ollamaModels)('finds $id by exact match', ({ id, displayName, family }) => {
    const entry = getRegistryEntry(id, 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe(id)
    expect(entry!.displayName).toBe(displayName)
    expect(entry!.provider).toBe('ollama')
    expect(entry!.tier).toBe('supported')
    expect(entry!.ollamaFamily).toBe(family)
  })
})

// ── Ollama Pattern Matching ─────────────────────────────────────

describe('getRegistryEntry — Ollama pattern matching', () => {
  it('matches translategemma:4b-it to translategemma:4b', () => {
    const entry = getRegistryEntry('translategemma:4b-it', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:4b')
  })

  it('matches translategemma:12b-fp16 to translategemma:12b', () => {
    const entry = getRegistryEntry('translategemma:12b-fp16', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:12b')
  })

  it('matches gemma3:4b-it to gemma3:4b', () => {
    const entry = getRegistryEntry('gemma3:4b-it', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('gemma3:4b')
  })

  it('strips path prefixes for matching (MLX community translategemma)', () => {
    const entry = getRegistryEntry('mlx-community/translategemma-4b-it-4bit', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:4b')
  })

  it('strips path prefixes for matching (MLX community gemma3)', () => {
    const entry = getRegistryEntry('mlx-community/gemma-3-4b-it', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('gemma3:4b')
  })
})

// ── Ollama Family Matching ──────────────────────────────────────

describe('getRegistryEntry — Ollama family matching', () => {
  it('matches bare "translategemma" to translategemma:4b (first in family)', () => {
    const entry = getRegistryEntry('translategemma', 'ollama', 'translategemma')
    expect(entry).not.toBeNull()
    expect(entry!.ollamaFamily).toBe('translategemma')
    // Should resolve to the first translategemma entry (4b)
    expect(entry!.id).toBe('translategemma:4b')
  })

  it('matches unknown gemma3 model via family', () => {
    const entry = getRegistryEntry('gemma3:1b', 'ollama', 'gemma3')
    expect(entry).not.toBeNull()
    expect(entry!.ollamaFamily).toBe('gemma3')
    expect(entry!.id).toBe('gemma3:4b')
  })

  it('does not match family from wrong provider', () => {
    const entry = getRegistryEntry('unknown-model', 'openai', 'translategemma')
    expect(entry).toBeNull()
  })
})

// ── TranslateGemma Pattern Matching ─────────────────────────────

describe('getRegistryEntry — TranslateGemma patterns', () => {
  it('matches "translate-gemma" to translategemma:12b via broad pattern', () => {
    const entry = getRegistryEntry('translate-gemma', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:12b')
  })

  it('matches "translategemma-4b-it" to translategemma:4b via pattern', () => {
    const entry = getRegistryEntry('translategemma-4b-it', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:4b')
  })

  it('matches "gemma-translate" to translategemma:12b via broad pattern', () => {
    const entry = getRegistryEntry('gemma-translate', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:12b')
  })

  it('matches "translate_gemma_4b" to translategemma:4b via pattern', () => {
    const entry = getRegistryEntry('translate_gemma_4b', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:4b')
  })

  it('matches "translategemma:12b-it" (with colon) to translategemma:12b via base extraction', () => {
    // With colon separator, extractOllamaBase extracts "translategemma:12b" → exact match
    const entry = getRegistryEntry('translategemma:12b-it', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:12b')
  })

  it('matches "translategemma-12b-it" (no colon) to translategemma:12b via pattern', () => {
    // Without colon, the 12b entry's specific '^translategemma[:\-_]?12b' pattern matches
    const entry = getRegistryEntry('translategemma-12b-it', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:12b')
  })

  it('matches MLX path-prefixed translategemma-4b-it-4bit', () => {
    const entry = getRegistryEntry('mlx-community/translategemma-4b-it-4bit', 'ollama')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:4b')
  })
})

// ── Unknown / Not Found ─────────────────────────────────────────

describe('getRegistryEntry — unknown models', () => {
  it('returns null for completely unknown Ollama model', () => {
    expect(getRegistryEntry('phi-4:14b', 'ollama')).toBeNull()
  })

  it('returns null for unknown OpenAI model', () => {
    expect(getRegistryEntry('gpt-5-turbo', 'openai')).toBeNull()
  })

  it('returns null for unknown Google model', () => {
    expect(getRegistryEntry('gemini-3.0-ultra', 'google')).toBeNull()
  })

  it('returns null for unknown Anthropic model', () => {
    expect(getRegistryEntry('claude-opus-5', 'anthropic')).toBeNull()
  })

  it('returns null for unknown openai-compatible model', () => {
    expect(getRegistryEntry('some-custom-model', 'openai-compatible')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getRegistryEntry('', 'openai')).toBeNull()
  })
})

// ── Profile Validation — Specific Models ────────────────────────

describe('resolveExecutionProfile — specific model profiles', () => {
  it('GPT-5.4: json-schema, premium, stable output, safe input budget', () => {
    const { profile } = resolveExecutionProfile('gpt-5.4', 'openai')
    expect(profile.structuredOutputMethod).toBe('json-schema')
    expect(profile.promptStyleId).toBe('default')
    expect(profile.contextUsageMultiplier).toBe(1.2)
    expect(profile.maxCompletionTokens).toBe(16_384)
    expect(profile.safeInputBudget).toBe(200_000)
    expect(profile.outputStabilityThreshold).toBe(0.9)
    expect(profile.supportsSystemRole).toBe(true)
    expect(profile.translationOnly).toBe(false)
    expect(profile.retryBaseDelayMs).toBe(1000)
    expect(profile.reviewDepth).toBe('thorough')
    expect(profile.defaultLookbehind).toBe(5)
    expect(profile.defaultLookahead).toBe(3)
    expect(profile.memoryInjection).toBe('full')
  })

  it('GPT-5.4 Mini: json-schema, balanced, large context multiplier', () => {
    const { profile } = resolveExecutionProfile('gpt-5.4-mini', 'openai')
    expect(profile.structuredOutputMethod).toBe('json-schema')
    expect(profile.contextUsageMultiplier).toBe(1.3)
    expect(profile.maxCompletionTokens).toBe(16_384)
    expect(profile.outputStabilityThreshold).toBe(0.9)
    expect(profile.retryBaseDelayMs).toBe(1000)
    expect(profile.reviewDepth).toBe('basic')
    expect(profile.defaultLookbehind).toBe(3)
    expect(profile.defaultLookahead).toBe(3)
    expect(profile.memoryInjection).toBe('full')
  })

  it('Gemini 3.1 Pro Preview: json-schema, premium, thorough review', () => {
    const { profile } = resolveExecutionProfile('gemini-3.1-pro-preview', 'google')
    expect(profile.structuredOutputMethod).toBe('json-schema')
    expect(profile.promptStyleId).toBe('default')
    expect(profile.contextUsageMultiplier).toBe(1.3)
    expect(profile.maxCompletionTokens).toBe(16_384)
    expect(profile.retryBaseDelayMs).toBe(1500)
    expect(profile.reviewDepth).toBe('thorough')
    expect(profile.defaultLookbehind).toBe(5)
    expect(profile.defaultLookahead).toBe(3)
  })

  it('Gemini 3 Flash Preview: json-schema, balanced', () => {
    const { profile } = resolveExecutionProfile('gemini-3-flash-preview', 'google')
    expect(profile.structuredOutputMethod).toBe('json-schema')
    expect(profile.contextUsageMultiplier).toBe(1.2)
    expect(profile.maxCompletionTokens).toBe(16_384)
    expect(profile.retryBaseDelayMs).toBe(1500)
    expect(profile.reviewDepth).toBe('basic')
    expect(profile.defaultLookbehind).toBe(3)
    expect(profile.defaultLookahead).toBe(3)
  })

  it('Gemini 3.1 Flash-Lite Preview: json-schema, budget, lower stability', () => {
    const { profile } = resolveExecutionProfile('gemini-3.1-flash-lite-preview', 'google')
    expect(profile.structuredOutputMethod).toBe('json-schema')
    expect(profile.contextUsageMultiplier).toBe(1.0)
    expect(profile.maxCompletionTokens).toBe(8_192)
    expect(profile.outputStabilityThreshold).toBe(0.80)
    expect(profile.retryBaseDelayMs).toBe(1500)
    expect(profile.reviewDepth).toBe('basic')
  })

  it('Gemini 2.5 Flash: json-schema, balanced, stable fallback', () => {
    const { profile } = resolveExecutionProfile('gemini-2.5-flash', 'google')
    expect(profile.structuredOutputMethod).toBe('json-schema')
    expect(profile.contextUsageMultiplier).toBe(1.2)
    expect(profile.maxCompletionTokens).toBe(16_384)
    expect(profile.retryBaseDelayMs).toBe(1500)
    expect(profile.reviewDepth).toBe('basic')
  })

  it('Claude Opus 4.6: prompted, needs JSON reminder, premium, thorough', () => {
    const { profile } = resolveExecutionProfile('claude-opus-4-6', 'anthropic')
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.promptStyleId).toBe('default')
    expect(profile.needsJsonReminder).toBe(true)
    expect(profile.retryBaseDelayMs).toBe(2000)
    expect(profile.contextUsageMultiplier).toBe(1.3)
    expect(profile.maxCompletionTokens).toBe(16_384)
    expect(profile.outputStabilityThreshold).toBe(0.90)
    expect(profile.reviewDepth).toBe('thorough')
    expect(profile.defaultLookbehind).toBe(5)
    expect(profile.defaultLookahead).toBe(3)
    expect(profile.memoryInjection).toBe('full')
  })

  it('Claude Sonnet 4.6: prompted, needs JSON reminder, balanced', () => {
    const { profile } = resolveExecutionProfile('claude-sonnet-4-6', 'anthropic')
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.promptStyleId).toBe('default')
    expect(profile.needsJsonReminder).toBe(true)
    expect(profile.retryBaseDelayMs).toBe(2000)
    expect(profile.contextUsageMultiplier).toBe(1.2)
    expect(profile.maxCompletionTokens).toBe(16_384)
    expect(profile.reviewDepth).toBe('basic')
  })

  it('Claude Haiku 4.5: prompted, budget, terms-only memory', () => {
    const { profile } = resolveExecutionProfile('claude-haiku-4-5', 'anthropic')
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.needsJsonReminder).toBe(true)
    expect(profile.contextUsageMultiplier).toBe(1.0)
    expect(profile.maxCompletionTokens).toBe(8_192)
    expect(profile.outputStabilityThreshold).toBe(0.80)
    expect(profile.memoryInjection).toBe('terms-only')
  })

  it('TranslateGemma 4B: raw-completion, none structured output, translationOnly', () => {
    const { profile } = resolveExecutionProfile('translategemma:4b', 'ollama')
    expect(profile.structuredOutputMethod).toBe('none')
    expect(profile.promptStyleId).toBe('raw-completion')
    expect(profile.supportsSystemRole).toBe(false)
    expect(profile.translationOnly).toBe(true)
    expect(profile.canAnalyze).toBe(false)
    expect(profile.canReview).toBe(false)
    expect(profile.canTranslate).toBe(true)
    expect(profile.contextUsageMultiplier).toBe(1.0)
    expect(profile.maxCompletionTokens).toBe(4_096)
    expect(profile.retryBaseDelayMs).toBe(200)
    expect(profile.reviewDepth).toBe('none')
    expect(profile.memoryInjection).toBe('none')
    expect(profile.defaultLookbehind).toBe(2)
    expect(profile.defaultLookahead).toBe(1)
  })

  it('TranslateGemma 12B: same profile shape as 4B', () => {
    const { profile } = resolveExecutionProfile('translategemma:12b', 'ollama')
    expect(profile.structuredOutputMethod).toBe('none')
    expect(profile.promptStyleId).toBe('raw-completion')
    expect(profile.supportsSystemRole).toBe(false)
    expect(profile.translationOnly).toBe(true)
    expect(profile.canAnalyze).toBe(false)
    expect(profile.canReview).toBe(false)
    expect(profile.reviewDepth).toBe('none')
    expect(profile.memoryInjection).toBe('none')
    expect(profile.defaultLookbehind).toBe(2)
    expect(profile.defaultLookahead).toBe(1)
    expect(profile.retryBaseDelayMs).toBe(200)
  })

  it('Gemma 3 4B: no-system-role, ollama-format, needs JSON reminder', () => {
    const { profile } = resolveExecutionProfile('gemma3:4b', 'ollama')
    expect(profile.structuredOutputMethod).toBe('ollama-format')
    expect(profile.promptStyleId).toBe('no-system-role')
    expect(profile.supportsSystemRole).toBe(false)
    expect(profile.needsJsonReminder).toBe(true)
    expect(profile.contextUsageMultiplier).toBe(0.5)
    expect(profile.safeInputBudget).toBe(16_000)
    expect(profile.maxCompletionTokens).toBe(4_096)
    expect(profile.retryBaseDelayMs).toBe(200)
    expect(profile.reviewDepth).toBe('basic')
    expect(profile.memoryInjection).toBe('terms-only')
    expect(profile.defaultLookbehind).toBe(2)
    expect(profile.defaultLookahead).toBe(1)
  })

  it('Gemma 3 12B: no-system-role, ollama-format, larger budgets than 4B', () => {
    const { profile } = resolveExecutionProfile('gemma3:12b', 'ollama')
    expect(profile.structuredOutputMethod).toBe('ollama-format')
    expect(profile.promptStyleId).toBe('no-system-role')
    expect(profile.supportsSystemRole).toBe(false)
    expect(profile.needsJsonReminder).toBe(true)
    expect(profile.contextUsageMultiplier).toBe(0.7)
    expect(profile.safeInputBudget).toBe(24_000)
    expect(profile.maxCompletionTokens).toBe(8_192)
    expect(profile.retryBaseDelayMs).toBe(200)
    expect(profile.reviewDepth).toBe('basic')
    expect(profile.memoryInjection).toBe('terms-only')
    expect(profile.defaultLookbehind).toBe(3)
    expect(profile.defaultLookahead).toBe(2)
  })
})

// ── resolveExecutionProfile — Known vs Experimental ─────────────

describe('resolveExecutionProfile', () => {
  it('returns registry profile for known model', () => {
    const { profile, entry } = resolveExecutionProfile('gpt-5.4-mini', 'openai')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('gpt-5.4-mini')
    expect(profile.structuredOutputMethod).toBe('json-schema')
    expect(profile.promptStyleId).toBe('default')
    expect(profile.maxCompletionTokens).toBe(16_384)
  })

  it('returns experimental profile for unknown openai model', () => {
    const { profile, entry } = resolveExecutionProfile('unknown-model-xyz', 'openai')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('json-schema')
    expect(profile.maxCompletionTokens).toBe(4_096)
    expect(profile.contextUsageMultiplier).toBe(0.8)
  })

  it('returns experimental profile for unknown ollama model', () => {
    const { profile, entry } = resolveExecutionProfile('phi-4:14b', 'ollama')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('ollama-format')
    expect(profile.contextUsageMultiplier).toBe(0.6)
    expect(profile.needsJsonReminder).toBe(true)
  })

  it('returns experimental profile for unknown anthropic model', () => {
    const { profile, entry } = resolveExecutionProfile('claude-unknown', 'anthropic')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.needsJsonReminder).toBe(true)
  })

  it('returns experimental profile for unknown google model', () => {
    const { profile, entry } = resolveExecutionProfile('gemini-unknown', 'google')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.needsJsonReminder).toBe(true)
  })

  it('returns experimental profile for unknown openai-compatible model', () => {
    const { profile, entry } = resolveExecutionProfile('custom-llm', 'openai-compatible')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.contextUsageMultiplier).toBe(0.6)
  })

  it('returns a defensive copy (mutations do not affect registry)', () => {
    const { profile: p1 } = resolveExecutionProfile('gpt-5.4-mini', 'openai')
    p1.maxCompletionTokens = 999
    const { profile: p2 } = resolveExecutionProfile('gpt-5.4-mini', 'openai')
    expect(p2.maxCompletionTokens).not.toBe(999)
  })
})

// ── getModelCapabilities ────────────────────────────────────────

describe('getModelCapabilities', () => {
  it('GPT-5.4: 272K context, 32K output', () => {
    const caps = getModelCapabilities('gpt-5.4', 'openai')
    expect(caps.contextWindow).toBe(272_000)
    expect(caps.maxOutputTokens).toBe(32_768)
  })

  it('GPT-5.4 Mini: 1M context, 32K output', () => {
    const caps = getModelCapabilities('gpt-5.4-mini', 'openai')
    expect(caps.contextWindow).toBe(1_000_000)
    expect(caps.maxOutputTokens).toBe(32_768)
  })

  it('Gemini 3.1 Pro Preview: 1M context, 64K output', () => {
    const caps = getModelCapabilities('gemini-3.1-pro-preview', 'google')
    expect(caps.contextWindow).toBe(1_048_576)
    expect(caps.maxOutputTokens).toBe(65_536)
  })

  it('Gemini 3 Flash Preview: 1M context, 64K output', () => {
    const caps = getModelCapabilities('gemini-3-flash-preview', 'google')
    expect(caps.contextWindow).toBe(1_048_576)
    expect(caps.maxOutputTokens).toBe(65_536)
  })

  it('Gemini 3.1 Flash-Lite Preview: 1M context, 64K output', () => {
    const caps = getModelCapabilities('gemini-3.1-flash-lite-preview', 'google')
    expect(caps.contextWindow).toBe(1_048_576)
    expect(caps.maxOutputTokens).toBe(65_536)
  })

  it('Gemini 2.5 Flash: 1M context, 64K output', () => {
    const caps = getModelCapabilities('gemini-2.5-flash', 'google')
    expect(caps.contextWindow).toBe(1_048_576)
    expect(caps.maxOutputTokens).toBe(65_536)
  })

  it('Claude Opus 4.6: 1M context, 128K output', () => {
    const caps = getModelCapabilities('claude-opus-4-6', 'anthropic')
    expect(caps.contextWindow).toBe(1_000_000)
    expect(caps.maxOutputTokens).toBe(128_000)
  })

  it('Claude Sonnet 4.6: 1M context, 64K output', () => {
    const caps = getModelCapabilities('claude-sonnet-4-6', 'anthropic')
    expect(caps.contextWindow).toBe(1_000_000)
    expect(caps.maxOutputTokens).toBe(64_000)
  })

  it('Claude Haiku 4.5: 200K context, 64K output', () => {
    const caps = getModelCapabilities('claude-haiku-4-5', 'anthropic')
    expect(caps.contextWindow).toBe(200_000)
    expect(caps.maxOutputTokens).toBe(64_000)
  })

  it('TranslateGemma 4B: 8K context, 4K output', () => {
    const caps = getModelCapabilities('translategemma:4b', 'ollama')
    expect(caps.contextWindow).toBe(8_192)
    expect(caps.maxOutputTokens).toBe(4_096)
  })

  it('TranslateGemma 12B: 8K context, 4K output', () => {
    const caps = getModelCapabilities('translategemma:12b', 'ollama')
    expect(caps.contextWindow).toBe(8_192)
    expect(caps.maxOutputTokens).toBe(4_096)
  })

  it('Gemma 3 4B: 128K context, 8K output', () => {
    const caps = getModelCapabilities('gemma3:4b', 'ollama')
    expect(caps.contextWindow).toBe(128_000)
    expect(caps.maxOutputTokens).toBe(8_192)
  })

  it('Gemma 3 12B: 128K context, 8K output', () => {
    const caps = getModelCapabilities('gemma3:12b', 'ollama')
    expect(caps.contextWindow).toBe(128_000)
    expect(caps.maxOutputTokens).toBe(8_192)
  })

  it('returns experimental capabilities for unknown openai model', () => {
    const caps = getModelCapabilities('gpt-future', 'openai')
    expect(caps.contextWindow).toBe(128_000)
    expect(caps.maxOutputTokens).toBe(16_384)
  })

  it('returns experimental capabilities for unknown ollama model', () => {
    const caps = getModelCapabilities('unknown-local', 'ollama')
    expect(caps.contextWindow).toBe(4_096)
    expect(caps.maxOutputTokens).toBe(2_048)
  })

  it('returns experimental capabilities for unknown anthropic model', () => {
    const caps = getModelCapabilities('claude-future', 'anthropic')
    expect(caps.contextWindow).toBe(200_000)
    expect(caps.maxOutputTokens).toBe(8_192)
  })

  it('returns a copy — mutations do not affect subsequent calls', () => {
    const c1 = getModelCapabilities('gpt-5.4-mini', 'openai')
    c1.contextWindow = 1
    const c2 = getModelCapabilities('gpt-5.4-mini', 'openai')
    expect(c2.contextWindow).toBe(1_000_000)
  })
})

// ── Count Assertions ────────────────────────────────────────────

describe('listSupportedModels — counts', () => {
  it('returns 13 total models', () => {
    const all = listSupportedModels()
    expect(all).toHaveLength(13)
  })

  it('returns 2 openai models', () => {
    const models = listSupportedModels('openai')
    expect(models).toHaveLength(2)
    for (const m of models) {
      expect(m.provider).toBe('openai')
    }
  })

  it('returns 4 google models', () => {
    const models = listSupportedModels('google')
    expect(models).toHaveLength(4)
    for (const m of models) {
      expect(m.provider).toBe('google')
    }
  })

  it('returns 3 anthropic models', () => {
    const models = listSupportedModels('anthropic')
    expect(models).toHaveLength(3)
    for (const m of models) {
      expect(m.provider).toBe('anthropic')
    }
  })

  it('returns 4 ollama models', () => {
    const models = listSupportedModels('ollama')
    expect(models).toHaveLength(4)
    for (const m of models) {
      expect(m.provider).toBe('ollama')
    }
  })

  it('returns 0 openai-compatible models (none in registry)', () => {
    const models = listSupportedModels('openai-compatible')
    expect(models).toHaveLength(0)
  })

  it('all entries have required fields populated', () => {
    const all = listSupportedModels()
    for (const entry of all) {
      expect(entry.id).toBeTruthy()
      expect(entry.displayName).toBeTruthy()
      expect(entry.provider).toBeTruthy()
      expect(entry.tier).toBe('supported')
      expect(entry.contextWindow).toBeGreaterThan(0)
      expect(entry.maxOutputTokens).toBeGreaterThan(0)
      expect(entry.executionProfile).toBeDefined()
      expect(entry.executionProfile.structuredOutputMethod).toBeTruthy()
      expect(entry.executionProfile.promptStyleId).toBeTruthy()
    }
  })

  it('every model ID is unique across the full registry', () => {
    const all = listSupportedModels()
    const ids = all.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── Grouped Listing ─────────────────────────────────────────────

describe('listSupportedModelsGrouped', () => {
  it('returns a Map with provider keys', () => {
    const grouped = listSupportedModelsGrouped()
    expect(grouped).toBeInstanceOf(Map)
    expect(grouped.has('openai')).toBe(true)
    expect(grouped.has('google')).toBe(true)
    expect(grouped.has('anthropic')).toBe(true)
    expect(grouped.has('ollama')).toBe(true)
  })

  it('has correct counts per provider', () => {
    const grouped = listSupportedModelsGrouped()
    expect(grouped.get('openai')!).toHaveLength(2)
    expect(grouped.get('google')!).toHaveLength(4)
    expect(grouped.get('anthropic')!).toHaveLength(3)
    expect(grouped.get('ollama')!).toHaveLength(4)
  })

  it('total across groups equals total models', () => {
    const grouped = listSupportedModelsGrouped()
    let total = 0
    for (const entries of grouped.values()) {
      total += entries.length
    }
    expect(total).toBe(listSupportedModels().length)
  })

  it('does not include openai-compatible key (no registered models)', () => {
    const grouped = listSupportedModelsGrouped()
    expect(grouped.has('openai-compatible')).toBe(false)
  })
})

// ── Category Assignments ────────────────────────────────────────

describe('category assignments', () => {
  it('premium models: gpt-5.4, gemini-3.1-pro-preview, claude-opus-4-6', () => {
    expect(getRegistryEntry('gpt-5.4', 'openai')!.category).toBe('premium')
    expect(getRegistryEntry('gemini-3.1-pro-preview', 'google')!.category).toBe('premium')
    expect(getRegistryEntry('claude-opus-4-6', 'anthropic')!.category).toBe('premium')
  })

  it('balanced models: gpt-5.4-mini, gemini-3-flash-preview, gemini-2.5-flash, claude-sonnet-4-6', () => {
    expect(getRegistryEntry('gpt-5.4-mini', 'openai')!.category).toBe('balanced')
    expect(getRegistryEntry('gemini-3-flash-preview', 'google')!.category).toBe('balanced')
    expect(getRegistryEntry('gemini-2.5-flash', 'google')!.category).toBe('balanced')
    expect(getRegistryEntry('claude-sonnet-4-6', 'anthropic')!.category).toBe('balanced')
  })

  it('budget models: gemini-3.1-flash-lite-preview, claude-haiku-4-5', () => {
    expect(getRegistryEntry('gemini-3.1-flash-lite-preview', 'google')!.category).toBe('budget')
    expect(getRegistryEntry('claude-haiku-4-5', 'anthropic')!.category).toBe('budget')
  })

  it('local-translation: translategemma:4b, translategemma:12b', () => {
    expect(getRegistryEntry('translategemma:4b', 'ollama')!.category).toBe('local-translation')
    expect(getRegistryEntry('translategemma:12b', 'ollama')!.category).toBe('local-translation')
  })

  it('local-analysis: gemma3:4b, gemma3:12b', () => {
    expect(getRegistryEntry('gemma3:4b', 'ollama')!.category).toBe('local-analysis')
    expect(getRegistryEntry('gemma3:12b', 'ollama')!.category).toBe('local-analysis')
  })

  it('every model has a valid category', () => {
    const validCategories = ['premium', 'balanced', 'budget', 'local-translation', 'local-analysis']
    const all = listSupportedModels()
    for (const model of all) {
      expect(validCategories).toContain(model.category)
    }
  })
})

// ── Provider-Wide Assertions ────────────────────────────────────

describe('provider-wide assertions', () => {
  describe('all OpenAI models use json-schema', () => {
    const openaiIds = ['gpt-5.4', 'gpt-5.4-mini']

    it.each(openaiIds)('%s uses json-schema', (id) => {
      const entry = getRegistryEntry(id, 'openai')!
      expect(entry.executionProfile.structuredOutputMethod).toBe('json-schema')
    })

    it.each(openaiIds)('%s supports system role', (id) => {
      const entry = getRegistryEntry(id, 'openai')!
      expect(entry.executionProfile.supportsSystemRole).toBe(true)
    })

    it.each(openaiIds)('%s does not need JSON reminder', (id) => {
      const entry = getRegistryEntry(id, 'openai')!
      expect(entry.executionProfile.needsJsonReminder).toBe(false)
    })
  })

  describe('all Anthropic models use prompted + needsJsonReminder', () => {
    const anthropicIds = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5']

    it.each(anthropicIds)('%s uses prompted', (id) => {
      const entry = getRegistryEntry(id, 'anthropic')!
      expect(entry.executionProfile.structuredOutputMethod).toBe('prompted')
    })

    it.each(anthropicIds)('%s needs JSON reminder', (id) => {
      const entry = getRegistryEntry(id, 'anthropic')!
      expect(entry.executionProfile.needsJsonReminder).toBe(true)
    })
  })

  describe('all Google models use json-schema', () => {
    const googleIds = [
      'gemini-3.1-pro-preview', 'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash',
    ]

    it.each(googleIds)('%s uses json-schema', (id) => {
      const entry = getRegistryEntry(id, 'google')!
      expect(entry.executionProfile.structuredOutputMethod).toBe('json-schema')
    })
  })

  describe('all Ollama models have retryBaseDelayMs 200', () => {
    const ollamaIds = ['translategemma:4b', 'translategemma:12b', 'gemma3:4b', 'gemma3:12b']

    it.each(ollamaIds)('%s has retryBaseDelayMs 200', (id) => {
      const { profile } = resolveExecutionProfile(id, 'ollama')
      expect(profile.retryBaseDelayMs).toBe(200)
    })
  })
})

// ── TranslateGemma Behavior ─────────────────────────────────────

describe('TranslateGemma behavior', () => {
  const translategemmaIds = ['translategemma:4b', 'translategemma:12b'] as const

  it.each(translategemmaIds)('%s is marked translationOnly', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.executionProfile.translationOnly).toBe(true)
  })

  it.each(translategemmaIds)('%s cannot analyze', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.executionProfile.canAnalyze).toBe(false)
  })

  it.each(translategemmaIds)('%s cannot review', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.executionProfile.canReview).toBe(false)
  })

  it.each(translategemmaIds)('%s does not support system role', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.executionProfile.supportsSystemRole).toBe(false)
  })

  it.each(translategemmaIds)('%s uses raw-completion prompt style', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.executionProfile.promptStyleId).toBe('raw-completion')
  })

  it.each(translategemmaIds)('%s uses "none" structured output', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.executionProfile.structuredOutputMethod).toBe('none')
  })

  it.each(translategemmaIds)('%s has 8K context window', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.contextWindow).toBe(8_192)
  })

  it.each(translategemmaIds)('%s has reviewDepth "none"', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.executionProfile.reviewDepth).toBe('none')
  })

  it.each(translategemmaIds)('%s has memoryInjection "none"', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.executionProfile.memoryInjection).toBe('none')
  })

  it.each(translategemmaIds)('%s has defaultLookbehind 2 and defaultLookahead 1', (id) => {
    const entry = getRegistryEntry(id, 'ollama')!
    expect(entry.executionProfile.defaultLookbehind).toBe(2)
    expect(entry.executionProfile.defaultLookahead).toBe(1)
  })
})

// ── Gemma 3 Behavior ────────────────────────────────────────────

describe('Gemma 3 behavior', () => {
  it('gemma3:4b does not support system role', () => {
    const entry = getRegistryEntry('gemma3:4b', 'ollama')!
    expect(entry.executionProfile.supportsSystemRole).toBe(false)
  })

  it('gemma3:4b uses no-system-role prompt style', () => {
    const entry = getRegistryEntry('gemma3:4b', 'ollama')!
    expect(entry.executionProfile.promptStyleId).toBe('no-system-role')
  })

  it('gemma3:4b needs JSON reminder', () => {
    const entry = getRegistryEntry('gemma3:4b', 'ollama')!
    expect(entry.executionProfile.needsJsonReminder).toBe(true)
  })

  it('gemma3:4b uses ollama-format structured output', () => {
    const entry = getRegistryEntry('gemma3:4b', 'ollama')!
    expect(entry.executionProfile.structuredOutputMethod).toBe('ollama-format')
  })

  it('gemma3:4b can analyze, review, and translate (general purpose)', () => {
    const entry = getRegistryEntry('gemma3:4b', 'ollama')!
    expect(entry.executionProfile.canAnalyze).toBe(true)
    expect(entry.executionProfile.canReview).toBe(true)
    expect(entry.executionProfile.canTranslate).toBe(true)
    expect(entry.executionProfile.translationOnly).toBe(false)
  })

  it('gemma3:4b has reviewDepth "basic" and memoryInjection "terms-only"', () => {
    const entry = getRegistryEntry('gemma3:4b', 'ollama')!
    expect(entry.executionProfile.reviewDepth).toBe('basic')
    expect(entry.executionProfile.memoryInjection).toBe('terms-only')
  })

  it('gemma3:4b has defaultLookbehind 2 and defaultLookahead 1', () => {
    const entry = getRegistryEntry('gemma3:4b', 'ollama')!
    expect(entry.executionProfile.defaultLookbehind).toBe(2)
    expect(entry.executionProfile.defaultLookahead).toBe(1)
  })
})

// ── New Fields Assertions ───────────────────────────────────────

describe('new execution profile fields', () => {
  describe('premium models have thorough reviewDepth and expanded context', () => {
    const premiumModels = [
      { id: 'gpt-5.4', provider: 'openai' as const },
      { id: 'gemini-3.1-pro-preview', provider: 'google' as const },
      { id: 'claude-opus-4-6', provider: 'anthropic' as const },
    ]

    it.each(premiumModels)('$id has reviewDepth "thorough"', ({ id, provider }) => {
      const entry = getRegistryEntry(id, provider)!
      expect(entry.executionProfile.reviewDepth).toBe('thorough')
    })

    it.each(premiumModels)('$id has defaultLookbehind 5', ({ id, provider }) => {
      const entry = getRegistryEntry(id, provider)!
      expect(entry.executionProfile.defaultLookbehind).toBe(5)
    })

    it.each(premiumModels)('$id has defaultLookahead 3', ({ id, provider }) => {
      const entry = getRegistryEntry(id, provider)!
      expect(entry.executionProfile.defaultLookahead).toBe(3)
    })
  })

  describe('balanced/budget cloud models have basic reviewDepth and default context', () => {
    const balancedBudgetModels = [
      { id: 'gpt-5.4-mini', provider: 'openai' as const },
      { id: 'gemini-3-flash-preview', provider: 'google' as const },
      { id: 'gemini-3.1-flash-lite-preview', provider: 'google' as const },
      { id: 'gemini-2.5-flash', provider: 'google' as const },
      { id: 'claude-sonnet-4-6', provider: 'anthropic' as const },
      { id: 'claude-haiku-4-5', provider: 'anthropic' as const },
    ]

    it.each(balancedBudgetModels)('$id has reviewDepth "basic"', ({ id, provider }) => {
      const entry = getRegistryEntry(id, provider)!
      expect(entry.executionProfile.reviewDepth).toBe('basic')
    })

    it.each(balancedBudgetModels)('$id has defaultLookbehind 3', ({ id, provider }) => {
      const entry = getRegistryEntry(id, provider)!
      expect(entry.executionProfile.defaultLookbehind).toBe(3)
    })

    it.each(balancedBudgetModels)('$id has defaultLookahead 3', ({ id, provider }) => {
      const entry = getRegistryEntry(id, provider)!
      expect(entry.executionProfile.defaultLookahead).toBe(3)
    })
  })

  describe('local models have reduced lookbehind/lookahead', () => {
    const smallLocalModels = [
      'translategemma:4b', 'translategemma:12b', 'gemma3:4b',
    ]

    it.each(smallLocalModels)('%s has defaultLookbehind 2', (id) => {
      const entry = getRegistryEntry(id, 'ollama')!
      expect(entry.executionProfile.defaultLookbehind).toBe(2)
    })

    it.each(smallLocalModels)('%s has defaultLookahead 1', (id) => {
      const entry = getRegistryEntry(id, 'ollama')!
      expect(entry.executionProfile.defaultLookahead).toBe(1)
    })

    it('gemma3:12b has expanded lookbehind/lookahead (3/2)', () => {
      const entry = getRegistryEntry('gemma3:12b', 'ollama')!
      expect(entry.executionProfile.defaultLookbehind).toBe(3)
      expect(entry.executionProfile.defaultLookahead).toBe(2)
    })
  })

  describe('memoryInjection per model tier', () => {
    it('premium OpenAI model (gpt-5.4) has memoryInjection "full"', () => {
      const entry = getRegistryEntry('gpt-5.4', 'openai')!
      expect(entry.executionProfile.memoryInjection).toBe('full')
    })

    it('balanced OpenAI model (gpt-5.4-mini) has memoryInjection "full"', () => {
      const entry = getRegistryEntry('gpt-5.4-mini', 'openai')!
      expect(entry.executionProfile.memoryInjection).toBe('full')
    })

    it('budget Anthropic model (claude-haiku-4-5) has memoryInjection "terms-only"', () => {
      const entry = getRegistryEntry('claude-haiku-4-5', 'anthropic')!
      expect(entry.executionProfile.memoryInjection).toBe('terms-only')
    })

    it('TranslateGemma models have memoryInjection "none"', () => {
      expect(getRegistryEntry('translategemma:4b', 'ollama')!.executionProfile.memoryInjection).toBe('none')
      expect(getRegistryEntry('translategemma:12b', 'ollama')!.executionProfile.memoryInjection).toBe('none')
    })

    it('Gemma 3 4B has memoryInjection "terms-only"', () => {
      const entry = getRegistryEntry('gemma3:4b', 'ollama')!
      expect(entry.executionProfile.memoryInjection).toBe('terms-only')
    })

    it('Gemma 3 12B has memoryInjection "terms-only"', () => {
      const entry = getRegistryEntry('gemma3:12b', 'ollama')!
      expect(entry.executionProfile.memoryInjection).toBe('terms-only')
    })
  })
})

// ── matchDetectedModels ─────────────────────────────────────────

describe('matchDetectedModels', () => {
  it('annotates a known cloud model as supported', () => {
    const detected: ModelInfo[] = [
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', providerId: 'openai', supportsStructuredOutput: true, supportsStreaming: true },
    ]
    const annotated = matchDetectedModels(detected, 'openai')
    expect(annotated).toHaveLength(1)
    expect(annotated[0]!.tier).toBe('supported')
    expect(annotated[0]!.registryEntry).not.toBeNull()
    expect(annotated[0]!.registryEntry!.id).toBe('gpt-5.4-mini')
    expect(annotated[0]!.displayName).toBe('GPT-5.4 Mini')
    expect(annotated[0]!.matchType).toBe('exact')
  })

  it('annotates an unknown model as experimental', () => {
    const detected: ModelInfo[] = [
      { id: 'gpt-5-turbo', name: 'GPT-5 Turbo', providerId: 'openai', supportsStructuredOutput: true, supportsStreaming: true },
    ]
    const annotated = matchDetectedModels(detected, 'openai')
    expect(annotated).toHaveLength(1)
    expect(annotated[0]!.tier).toBe('experimental')
    expect(annotated[0]!.registryEntry).toBeNull()
    expect(annotated[0]!.matchType).toBeNull()
    expect(annotated[0]!.displayName).toBe('GPT-5 Turbo')
  })

  it('correctly splits a mixed list into supported and experimental', () => {
    const detected: ModelInfo[] = [
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', providerId: 'openai', supportsStructuredOutput: true, supportsStreaming: true },
      { id: 'gpt-5.4', name: 'GPT-5.4', providerId: 'openai', supportsStructuredOutput: true, supportsStreaming: true },
      { id: 'custom-finetune-v2', name: 'Custom Finetune v2', providerId: 'openai', supportsStructuredOutput: true, supportsStreaming: true },
    ]
    const annotated = matchDetectedModels(detected, 'openai')
    expect(annotated).toHaveLength(3)

    const supported = annotated.filter((a) => a.tier === 'supported')
    const experimental = annotated.filter((a) => a.tier === 'experimental')
    expect(supported).toHaveLength(2)
    expect(experimental).toHaveLength(1)

    expect(supported[0]!.registryEntry!.id).toBe('gpt-5.4-mini')
    expect(supported[1]!.registryEntry!.id).toBe('gpt-5.4')
    expect(experimental[0]!.registryEntry).toBeNull()
  })

  it('annotates TranslateGemma variant via pattern', () => {
    const detected: ModelInfo[] = [
      { id: 'translategemma-4b-it', name: 'translategemma-4b-it', providerId: 'ollama', family: 'translategemma', supportsStructuredOutput: true, supportsStreaming: true },
    ]
    const annotated = matchDetectedModels(detected, 'ollama')
    expect(annotated).toHaveLength(1)
    expect(annotated[0]!.tier).toBe('supported')
    expect(annotated[0]!.registryEntry!.id).toBe('translategemma:4b')
    expect(annotated[0]!.displayName).toBe('TranslateGemma 4B')
  })

  it('annotates Gemma 3 variant via family-based matching', () => {
    const detected: ModelInfo[] = [
      { id: 'gemma3:4b-instruct-q4_0', name: 'gemma3:4b-instruct-q4_0', providerId: 'ollama', family: 'gemma3', supportsStructuredOutput: true, supportsStreaming: true },
    ]
    const annotated = matchDetectedModels(detected, 'ollama')
    expect(annotated).toHaveLength(1)
    expect(annotated[0]!.tier).toBe('supported')
    expect(annotated[0]!.registryEntry!.id).toBe('gemma3:4b')
  })

  it('handles empty detected list', () => {
    const annotated = matchDetectedModels([], 'openai')
    expect(annotated).toEqual([])
  })

  it('preserves original ModelInfo in annotated results', () => {
    const original: ModelInfo = {
      id: 'gpt-5.4-mini',
      name: 'GPT-5.4 Mini',
      providerId: 'openai',
      parameterSize: '200B',
      supportsStructuredOutput: true,
      supportsStreaming: true,
    }
    const annotated = matchDetectedModels([original], 'openai')
    expect(annotated[0]!.modelInfo).toBe(original)
    expect(annotated[0]!.modelInfo.parameterSize).toBe('200B')
  })

  it('annotates multiple Ollama models with mixed supported/experimental', () => {
    const detected: ModelInfo[] = [
      { id: 'translategemma:4b', name: 'translategemma:4b', providerId: 'ollama', family: 'translategemma', supportsStructuredOutput: true, supportsStreaming: true },
      { id: 'gemma3:4b', name: 'gemma3:4b', providerId: 'ollama', family: 'gemma3', supportsStructuredOutput: true, supportsStreaming: true },
      { id: 'phi-4:14b', name: 'phi-4:14b', providerId: 'ollama', family: 'phi4', supportsStructuredOutput: true, supportsStreaming: true },
      { id: 'llama3.3:70b', name: 'llama3.3:70b', providerId: 'ollama', family: 'llama3.3', supportsStructuredOutput: true, supportsStreaming: true },
    ]
    const annotated = matchDetectedModels(detected, 'ollama')
    expect(annotated).toHaveLength(4)

    expect(annotated[0]!.tier).toBe('supported')
    expect(annotated[0]!.registryEntry!.id).toBe('translategemma:4b')

    expect(annotated[1]!.tier).toBe('supported')
    expect(annotated[1]!.registryEntry!.id).toBe('gemma3:4b')

    expect(annotated[2]!.tier).toBe('experimental')
    expect(annotated[2]!.registryEntry).toBeNull()

    expect(annotated[3]!.tier).toBe('experimental')
    expect(annotated[3]!.registryEntry).toBeNull()
  })

  it('disambiguates quantization variants mapping to the same registry entry', () => {
    const detected: ModelInfo[] = [
      { id: 'mlx-community/gemma-3-12b-it-4bit', name: 'gemma-3-12b-it-4bit', providerId: 'openai-compatible', supportsStructuredOutput: true, supportsStreaming: true },
      { id: 'mlx-community/gemma-3-12b-it-8bit', name: 'gemma-3-12b-it-8bit', providerId: 'openai-compatible', supportsStructuredOutput: true, supportsStreaming: true },
    ]
    const annotated = matchDetectedModels(detected, 'openai-compatible')
    expect(annotated).toHaveLength(2)

    expect(annotated[0]!.registryEntry!.id).toBe('gemma3:12b')
    expect(annotated[0]!.displayName).toBe('Gemma 3 12B (4bit)')

    expect(annotated[1]!.registryEntry!.id).toBe('gemma3:12b')
    expect(annotated[1]!.displayName).toBe('Gemma 3 12B (8bit)')
  })

  it('does not add quantization suffix for exact registry ID matches', () => {
    const detected: ModelInfo[] = [
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', providerId: 'openai', supportsStructuredOutput: true, supportsStreaming: true },
    ]
    const annotated = matchDetectedModels(detected, 'openai')
    expect(annotated[0]!.displayName).toBe('GPT-5.4 Mini')
  })

  it('adds quantization suffix for MLX translategemma variants', () => {
    const detected: ModelInfo[] = [
      { id: 'mlx-community/translategemma-4b-it-4bit', name: 'translategemma-4b-it-4bit', providerId: 'openai-compatible', supportsStructuredOutput: true, supportsStreaming: true },
      { id: 'mlx-community/translategemma-12b-it-4bit', name: 'translategemma-12b-it-4bit', providerId: 'openai-compatible', supportsStructuredOutput: true, supportsStreaming: true },
    ]
    const annotated = matchDetectedModels(detected, 'openai-compatible')
    expect(annotated[0]!.displayName).toBe('TranslateGemma 4B (4bit)')
    expect(annotated[1]!.displayName).toBe('TranslateGemma 12B (4bit)')
  })
})

// ── resolveExecutionProfile — Experimental Profiles ─────────────

describe('resolveExecutionProfile — experimental fallbacks', () => {
  it('openai experimental uses json-schema, no JSON reminder', () => {
    const { profile, entry } = resolveExecutionProfile('gpt-future-model', 'openai')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('json-schema')
    expect(profile.needsJsonReminder).toBe(false)
    expect(profile.contextUsageMultiplier).toBe(0.8)
    expect(profile.maxCompletionTokens).toBe(4_096)
    expect(profile.promptStyleId).toBe('default')
  })

  it('google experimental uses prompted with JSON reminder', () => {
    const { profile, entry } = resolveExecutionProfile('gemini-future', 'google')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.needsJsonReminder).toBe(true)
    expect(profile.contextUsageMultiplier).toBe(0.8)
    expect(profile.maxCompletionTokens).toBe(4_096)
  })

  it('anthropic experimental uses prompted with JSON reminder', () => {
    const { profile, entry } = resolveExecutionProfile('claude-future', 'anthropic')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.needsJsonReminder).toBe(true)
    expect(profile.retryBaseDelayMs).toBe(2000)
  })

  it('ollama experimental uses ollama-format, very conservative', () => {
    const { profile, entry } = resolveExecutionProfile('unknown-local-model', 'ollama')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('ollama-format')
    expect(profile.needsJsonReminder).toBe(true)
    expect(profile.contextUsageMultiplier).toBe(0.6)
    expect(profile.retryBaseDelayMs).toBe(200)
    expect(profile.memoryInjection).toBe('terms-only')
  })

  it('openai-compatible experimental uses prompted, conservative', () => {
    const { profile, entry } = resolveExecutionProfile('custom-server-llm', 'openai-compatible')
    expect(entry).toBeNull()
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.needsJsonReminder).toBe(true)
    expect(profile.contextUsageMultiplier).toBe(0.6)
  })

  it('experimental profiles return defensive copies', () => {
    const { profile: p1 } = resolveExecutionProfile('unknown-1', 'openai')
    p1.maxCompletionTokens = 1
    const { profile: p2 } = resolveExecutionProfile('unknown-2', 'openai')
    expect(p2.maxCompletionTokens).toBe(4_096)
  })
})

// ── Cross-Provider Matching (MLX via openai-compatible) ────────

describe('cross-provider matching — MLX models via openai-compatible', () => {
  it('matches mlx-community/translategemma-4b-it-4bit to translategemma:4b', () => {
    const entry = getRegistryEntry('mlx-community/translategemma-4b-it-4bit', 'openai-compatible')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:4b')
  })

  it('matches mlx-community/translategemma-12b-it-4bit to translategemma:12b', () => {
    const entry = getRegistryEntry('mlx-community/translategemma-12b-it-4bit', 'openai-compatible')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('translategemma:12b')
  })

  it('matches mlx-community/gemma-3-12b-it-4bit to gemma3:12b', () => {
    const entry = getRegistryEntry('mlx-community/gemma-3-12b-it-4bit', 'openai-compatible')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('gemma3:12b')
  })

  it('matches mlx-community/gemma-3-12b-it-8bit to gemma3:12b', () => {
    const entry = getRegistryEntry('mlx-community/gemma-3-12b-it-8bit', 'openai-compatible')
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('gemma3:12b')
  })
})

// ── ollama-format → prompted fallback for non-Ollama providers ──

describe('resolveExecutionProfile — cross-provider ollama-format fallback', () => {
  it('overrides ollama-format to prompted for gemma3:12b via openai-compatible', () => {
    const { profile, entry } = resolveExecutionProfile(
      'mlx-community/gemma-3-12b-it-4bit',
      'openai-compatible',
    )
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe('gemma3:12b')
    // Should override ollama-format → prompted for non-ollama provider
    expect(profile.structuredOutputMethod).toBe('prompted')
    expect(profile.needsJsonReminder).toBe(true)
  })

  it('keeps ollama-format for gemma3:12b when provider is ollama', () => {
    const { profile } = resolveExecutionProfile('gemma3:12b', 'ollama')
    expect(profile.structuredOutputMethod).toBe('ollama-format')
  })

  it('does not override "none" structured output for translategemma via openai-compatible', () => {
    const { profile, entry } = resolveExecutionProfile(
      'mlx-community/translategemma-4b-it-4bit',
      'openai-compatible',
    )
    expect(entry).not.toBeNull()
    // translategemma uses 'none' for structured output, not ollama-format
    expect(profile.structuredOutputMethod).toBe('none')
  })
})
