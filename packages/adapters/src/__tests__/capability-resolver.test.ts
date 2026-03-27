import { describe, it, expect } from 'vitest'
import { lookupModelProfile, getProviderDefaults, mergeWithProviderOverrides } from '../capability-registry.js'
import { resolveCapabilities, selectOutputStrategy } from '../capability-resolver.js'

describe('lookupModelProfile', () => {
  it('matches TranslateGemma patterns', () => {
    const caps = lookupModelProfile('mlx-community/translategemma-4b-it-4bit')
    expect(caps).not.toBeNull()
    expect(caps!.quirks.translationOnly).toBe(true)
    expect(caps!.supportsStructuredOutput).toBe(false)
    expect(caps!.supportsSystemRole).toBe(false)
  })

  it('matches GPT-4o', () => {
    const caps = lookupModelProfile('gpt-4o')
    expect(caps).not.toBeNull()
    expect(caps!.supportsStructuredOutput).toBe(true)
    expect(caps!.contextWindow).toBe(128000)
  })

  it('matches GPT-4o-mini', () => {
    const caps = lookupModelProfile('gpt-4o-mini')
    expect(caps).not.toBeNull()
    expect(caps!.supportsStructuredOutput).toBe(true)
  })

  it('matches Gemma 3 models', () => {
    const caps = lookupModelProfile('gemma-3-27b-it')
    expect(caps).not.toBeNull()
    expect(caps!.supportsStructuredOutput).toBe(false)
    expect(caps!.supportsSystemRole).toBe(false)
    expect(caps!.contextWindow).toBe(128000)
  })

  it('matches Gemma 3 with quant suffix', () => {
    const caps = lookupModelProfile('gemma-3-12b-it:q4_0')
    expect(caps).not.toBeNull()
    expect(caps!.supportsStructuredOutput).toBe(false)
  })

  it('matches Claude models', () => {
    const caps = lookupModelProfile('claude-3-opus-20240229')
    expect(caps).not.toBeNull()
    expect(caps!.supportsStructuredOutput).toBe(false)
    expect(caps!.contextWindow).toBe(200000)
  })

  it('matches Gemini models', () => {
    const caps = lookupModelProfile('gemini-2.0-flash')
    expect(caps).not.toBeNull()
    expect(caps!.supportsStructuredOutput).toBe(false)
    expect(caps!.contextWindow).toBe(1048576)
  })

  it('matches Llama 3.1 models', () => {
    const caps = lookupModelProfile('llama3.1:70b')
    expect(caps).not.toBeNull()
    expect(caps!.contextWindow).toBe(128000)
  })

  it('matches Mistral models', () => {
    const caps = lookupModelProfile('mistral-large-latest')
    expect(caps).not.toBeNull()
    expect(caps!.contextWindow).toBe(128000)
  })

  it('matches Qwen 2.5 models', () => {
    const caps = lookupModelProfile('qwen2.5:14b')
    expect(caps).not.toBeNull()
    expect(caps!.contextWindow).toBe(131072)
  })

  it('returns null for unknown models', () => {
    const caps = lookupModelProfile('totally-unknown-model-xyz')
    expect(caps).toBeNull()
  })
})

describe('getProviderDefaults', () => {
  it('returns structured output ON for ollama', () => {
    const caps = getProviderDefaults('ollama')
    expect(caps.supportsStructuredOutput).toBe(true)
  })

  it('returns structured output ON for openai', () => {
    const caps = getProviderDefaults('openai')
    expect(caps.supportsStructuredOutput).toBe(true)
  })

  it('returns structured output OFF for google', () => {
    const caps = getProviderDefaults('google')
    expect(caps.supportsStructuredOutput).toBe(false)
  })

  it('returns structured output OFF for openai-compatible', () => {
    const caps = getProviderDefaults('openai-compatible')
    expect(caps.supportsStructuredOutput).toBe(false)
  })
})

describe('mergeWithProviderOverrides', () => {
  it('enables structured output for Ollama regardless of registry', () => {
    const registryCaps = lookupModelProfile('gemma-3-27b-it')!
    expect(registryCaps.supportsStructuredOutput).toBe(false)

    const merged = mergeWithProviderOverrides(registryCaps, 'ollama')
    expect(merged.supportsStructuredOutput).toBe(true)
  })

  it('does not override for non-Ollama providers', () => {
    const registryCaps = lookupModelProfile('gemma-3-27b-it')!
    const merged = mergeWithProviderOverrides(registryCaps, 'google')
    expect(merged.supportsStructuredOutput).toBe(false)
  })
})

describe('selectOutputStrategy', () => {
  it('returns raw for translation-only models', () => {
    expect(
      selectOutputStrategy({
        supportsStructuredOutput: false,
        supportsSystemRole: false,
        contextWindow: null,
        maxOutputTokens: null,
        supportsGeneralReasoning: false,
        quirks: { requiresFlattenedContent: true, translationOnly: true },
      }),
    ).toBe('raw')
  })

  it('returns structured for models with structured output support', () => {
    expect(
      selectOutputStrategy({
        supportsStructuredOutput: true,
        supportsSystemRole: true,
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsGeneralReasoning: true,
        quirks: { requiresFlattenedContent: false, translationOnly: false },
      }),
    ).toBe('structured')
  })

  it('returns prompted for models without structured output', () => {
    expect(
      selectOutputStrategy({
        supportsStructuredOutput: false,
        supportsSystemRole: true,
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsGeneralReasoning: true,
        quirks: { requiresFlattenedContent: false, translationOnly: false },
      }),
    ).toBe('prompted')
  })
})

describe('resolveCapabilities', () => {
  it('returns registry match for known GPT-4o model', () => {
    const result = resolveCapabilities('gpt-4o', 'openai')
    expect(result.source).toBe('registry')
    expect(result.capabilities.supportsStructuredOutput).toBe(true)
    expect(result.outputStrategy).toBe('structured')
  })

  it('returns registry match for Gemma 3 on Google provider', () => {
    const result = resolveCapabilities('gemma-3-27b-it', 'google')
    expect(result.source).toBe('registry')
    expect(result.capabilities.supportsStructuredOutput).toBe(false)
    expect(result.outputStrategy).toBe('prompted')
  })

  it('applies Ollama override — enables structured output for Gemma 3', () => {
    const result = resolveCapabilities('gemma-3-12b-it:q4_0', 'ollama')
    expect(result.source).toBe('registry')
    expect(result.capabilities.supportsStructuredOutput).toBe(true)
    expect(result.outputStrategy).toBe('structured')
  })

  it('falls back to provider defaults for unknown models', () => {
    const result = resolveCapabilities('totally-unknown-model', 'openai-compatible')
    expect(result.source).toBe('provider-default')
    expect(result.capabilities.supportsStructuredOutput).toBe(false)
    expect(result.outputStrategy).toBe('prompted')
  })

  it('returns raw strategy for TranslateGemma', () => {
    const result = resolveCapabilities('mlx-community/translategemma-4b-it-4bit', 'openai-compatible')
    expect(result.source).toBe('registry')
    expect(result.outputStrategy).toBe('raw')
    expect(result.capabilities.quirks.translationOnly).toBe(true)
  })

  it('respects user override when capabilities are on ModelInfo', () => {
    const result = resolveCapabilities('any-model', 'openai-compatible', {
      id: 'any-model',
      name: 'Any Model',
      providerId: 'openai-compatible',
      supportsStructuredOutput: true,
      supportsStreaming: true,
      capabilities: {
        supportsStructuredOutput: true,
        supportsSystemRole: true,
        contextWindow: 32000,
        maxOutputTokens: 4096,
        supportsGeneralReasoning: true,
        quirks: { requiresFlattenedContent: false, translationOnly: false },
      },
    })
    expect(result.source).toBe('user-override')
    expect(result.capabilities.supportsStructuredOutput).toBe(true)
    expect(result.outputStrategy).toBe('structured')
  })
})
