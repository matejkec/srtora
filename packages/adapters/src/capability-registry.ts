import type { ModelCapabilities, ProviderType } from '@srtora/types'

/**
 * A model profile entry in the capability registry.
 * Can be an exact model ID match or a regex pattern.
 */
interface ModelProfile {
  /** Regex pattern to match model IDs (case-insensitive) */
  pattern: RegExp
  capabilities: ModelCapabilities
}

/**
 * Registry of known model capability profiles.
 *
 * Order matters — first match wins. Put specific patterns before broad ones.
 */
const MODEL_REGISTRY: ModelProfile[] = [
  // === TranslateGemma (dedicated translation model) ===
  {
    pattern: /translate.*gemma|gemma.*translate/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: false,
      contextWindow: 8192,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: false,
      quirks: {
        requiresFlattenedContent: true,
        translationOnly: true,
      },
    },
  },

  // === OpenAI models ===
  {
    pattern: /^gpt-4o/i,
    capabilities: {
      supportsStructuredOutput: true,
      supportsSystemRole: true,
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /^gpt-4-turbo/i,
    capabilities: {
      supportsStructuredOutput: true,
      supportsSystemRole: true,
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /^gpt-4(?!o)/i,
    capabilities: {
      supportsStructuredOutput: true,
      supportsSystemRole: true,
      contextWindow: 8192,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /^gpt-3\.5/i,
    capabilities: {
      supportsStructuredOutput: true,
      supportsSystemRole: true,
      contextWindow: 16385,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /^o[1-9]/i,
    capabilities: {
      supportsStructuredOutput: true,
      supportsSystemRole: true,
      contextWindow: 200000,
      maxOutputTokens: 100000,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },

  // === Anthropic Claude models ===
  {
    pattern: /^claude-.*opus|^claude-.*sonnet|^claude-.*haiku/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },

  // === Google Gemini models (via OpenAI-compatible API) ===
  {
    pattern: /^gemini-2/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /^gemini-1\.5-pro/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 2097152,
      maxOutputTokens: 8192,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /^gemini-1\.5-flash/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },

  // === Google Gemma models (open-weight, via Ollama or OpenAI-compatible) ===
  // NOTE: These are the open-source Gemma models, NOT Gemini API models.
  // Via OpenAI-compatible endpoints they typically don't support json_schema.
  // Via Ollama they DO support structured output through Ollama's native format field.
  // The provider default will override supportsStructuredOutput for Ollama.
  {
    pattern: /^gemma-3/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: false,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /^gemma-2/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: false,
      contextWindow: 8192,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /^gemma/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: false,
      contextWindow: 8192,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },

  // === Meta Llama models ===
  {
    pattern: /llama[-_]?3\.3/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /llama[-_]?3\.1/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /llama[-_]?3/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 8192,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },

  // === Mistral models ===
  {
    pattern: /mistral[-_]?large/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /mistral/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 32768,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },

  // === Qwen models ===
  {
    pattern: /qwen[-_]?2\.5/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /qwen/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 32768,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },

  // === DeepSeek models ===
  {
    pattern: /deepseek/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 65536,
      maxOutputTokens: 8192,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },

  // === Phi models (Microsoft) ===
  {
    pattern: /phi[-_]?4/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 16384,
      maxOutputTokens: 4096,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
  {
    pattern: /phi[-_]?3/i,
    capabilities: {
      supportsStructuredOutput: false,
      supportsSystemRole: true,
      contextWindow: 4096,
      maxOutputTokens: 2048,
      supportsGeneralReasoning: true,
      quirks: { requiresFlattenedContent: false, translationOnly: false },
    },
  },
]

/**
 * Conservative defaults per provider type.
 *
 * Key decisions:
 * - `ollama`: structured output ON because Ollama handles JSON format natively
 * - `openai`: structured output ON, large context
 * - `google`: structured output OFF — Google's OpenAI-compatible endpoint rejects json_schema
 * - `anthropic`: structured output OFF via OpenAI-compatible layer
 * - `openai-compatible`: structured output OFF — conservative default for unknown servers
 */
const PROVIDER_DEFAULTS: Record<ProviderType, ModelCapabilities> = {
  ollama: {
    supportsStructuredOutput: true,
    supportsSystemRole: true,
    contextWindow: null,
    maxOutputTokens: null,
    supportsGeneralReasoning: true,
    quirks: { requiresFlattenedContent: false, translationOnly: false },
  },
  openai: {
    supportsStructuredOutput: true,
    supportsSystemRole: true,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsGeneralReasoning: true,
    quirks: { requiresFlattenedContent: false, translationOnly: false },
  },
  google: {
    supportsStructuredOutput: false,
    supportsSystemRole: true,
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    supportsGeneralReasoning: true,
    quirks: { requiresFlattenedContent: false, translationOnly: false },
  },
  anthropic: {
    supportsStructuredOutput: false,
    supportsSystemRole: true,
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsGeneralReasoning: true,
    quirks: { requiresFlattenedContent: false, translationOnly: false },
  },
  'openai-compatible': {
    supportsStructuredOutput: false,
    supportsSystemRole: true,
    contextWindow: null,
    maxOutputTokens: null,
    supportsGeneralReasoning: true,
    quirks: { requiresFlattenedContent: false, translationOnly: false },
  },
}

/**
 * Look up model capabilities from the registry by matching model ID against known patterns.
 * Returns the first matching profile or null.
 */
export function lookupModelProfile(modelId: string): ModelCapabilities | null {
  // Strip common path prefixes (e.g. "mlx-community/gemma-3-4b-it-4bit" → "gemma-3-4b-it-4bit")
  const baseName = modelId.includes('/') ? modelId.split('/').pop()! : modelId
  // Also strip version/quant suffixes for matching (e.g. "gemma-3-27b-it:q4_0" → "gemma-3-27b-it")
  const cleanName = baseName.split(':')[0]!

  for (const profile of MODEL_REGISTRY) {
    if (profile.pattern.test(modelId) || profile.pattern.test(baseName) || profile.pattern.test(cleanName)) {
      return { ...profile.capabilities }
    }
  }

  return null
}

/**
 * Get default capabilities for a provider type.
 */
export function getProviderDefaults(providerType: ProviderType): ModelCapabilities {
  return { ...PROVIDER_DEFAULTS[providerType] }
}

/**
 * Merge registry capabilities with provider-specific overrides.
 *
 * For Ollama: if the registry says structured output is off (e.g., for Gemma),
 * the Ollama provider can override it to true because Ollama natively handles
 * JSON format via its `format` field regardless of the model's training.
 */
export function mergeWithProviderOverrides(
  registryCaps: ModelCapabilities,
  providerType: ProviderType,
): ModelCapabilities {
  if (providerType === 'ollama') {
    return {
      ...registryCaps,
      // Ollama handles structured output natively via the format field
      supportsStructuredOutput: true,
    }
  }
  return registryCaps
}
