import type { ModelCapabilities, ModelInfo, OutputStrategyType, ProviderType, ResolvedCapabilities } from '@srtora/types'
import { lookupModelProfile, getProviderDefaults, mergeWithProviderOverrides } from './capability-registry.js'

/**
 * Select the best output strategy based on model capabilities.
 */
export function selectOutputStrategy(capabilities: ModelCapabilities): OutputStrategyType {
  if (capabilities.quirks.translationOnly) {
    return 'raw'
  }
  if (capabilities.supportsStructuredOutput) {
    return 'structured'
  }
  return 'prompted'
}

/**
 * Resolve model capabilities using a three-tier resolution chain:
 *
 * 1. Check the model registry for a known profile (pattern match)
 * 2. Fall back to provider-type defaults
 * 3. Apply provider-specific overrides (e.g., Ollama enables structured output)
 *
 * If the model already has capabilities set (e.g., from user override),
 * those take precedence.
 */
export function resolveCapabilities(
  modelId: string,
  providerType: ProviderType,
  existingModelInfo?: ModelInfo,
): ResolvedCapabilities {
  // 1. User override takes precedence
  if (existingModelInfo?.capabilities) {
    const caps = existingModelInfo.capabilities
    return {
      capabilities: caps,
      outputStrategy: selectOutputStrategy(caps),
      source: 'user-override',
    }
  }

  // 2. Check model registry
  const registryCaps = lookupModelProfile(modelId)
  if (registryCaps) {
    // Apply provider-specific overrides (e.g., Ollama structured output)
    const merged = mergeWithProviderOverrides(registryCaps, providerType)
    return {
      capabilities: merged,
      outputStrategy: selectOutputStrategy(merged),
      source: 'registry',
    }
  }

  // 3. Fall back to provider defaults
  const providerCaps = getProviderDefaults(providerType)
  return {
    capabilities: providerCaps,
    outputStrategy: selectOutputStrategy(providerCaps),
    source: 'provider-default',
  }
}
