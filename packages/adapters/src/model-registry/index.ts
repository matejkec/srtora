/**
 * Model Registry — Public API
 *
 * The model registry is the single source of truth for all officially
 * supported models in SRTora. It provides:
 *
 * - Lookup: Find a registry entry by model ID and provider
 * - Matching: Annotate runtime-discovered models against the registry
 * - Listing: Get all supported models, optionally filtered by provider
 * - Fallbacks: Conservative defaults for experimental/unknown models
 *
 * To add a new supported model, add an entry to the appropriate
 * profiles/ file. No other code changes are needed.
 */

import type {
  ModelRegistryEntry,
  ModelInfo,
  ProviderType,
  ExecutionProfile,
} from '@srtora/types'
import { MODEL_REGISTRY } from './registry-data.js'
import { matchModel, annotateDetectedModels } from './matcher.js'
import { getExperimentalProfile, EXPERIMENTAL_CAPABILITIES } from './experimental.js'

export type { AnnotatedModel } from './matcher.js'
export { getExperimentalProfile } from './experimental.js'
export { EXPERIMENTAL_CAPABILITIES } from './experimental.js'

/**
 * Look up a model in the registry by ID and provider.
 * Returns the full registry entry or null if not found.
 */
export function getRegistryEntry(
  modelId: string,
  providerType: ProviderType,
  ollamaFamily?: string,
): ModelRegistryEntry | null {
  const match = matchModel(modelId, providerType, ollamaFamily)
  return match?.entry ?? null
}

/**
 * Resolve the execution profile for a model.
 *
 * Returns the model's tuned profile if found in the registry,
 * or a conservative experimental profile based on provider type.
 */
export function resolveExecutionProfile(
  modelId: string,
  providerType: ProviderType,
  ollamaFamily?: string,
): { profile: ExecutionProfile; entry: ModelRegistryEntry | null } {
  const entry = getRegistryEntry(modelId, providerType, ollamaFamily)

  if (entry) {
    const profile = { ...entry.executionProfile }

    // Cross-provider fix: ollama-format only works with Ollama's native API.
    // When an ollama-registered model is served via openai-compatible (e.g., MLX),
    // fall back to prompted JSON output.
    if (profile.structuredOutputMethod === 'ollama-format' && providerType !== 'ollama') {
      profile.structuredOutputMethod = 'prompted'
      profile.needsJsonReminder = true
    }

    return { profile, entry }
  }

  return { profile: getExperimentalProfile(providerType), entry: null }
}

/**
 * Get context window and max output tokens for a model.
 *
 * Uses registry data if available, otherwise conservative provider defaults.
 */
export function getModelCapabilities(
  modelId: string,
  providerType: ProviderType,
  ollamaFamily?: string,
): { contextWindow: number; maxOutputTokens: number } {
  const entry = getRegistryEntry(modelId, providerType, ollamaFamily)

  if (entry) {
    return {
      contextWindow: entry.contextWindow,
      maxOutputTokens: entry.maxOutputTokens,
    }
  }

  return { ...EXPERIMENTAL_CAPABILITIES[providerType] }
}

/**
 * List all supported models, optionally filtered by provider.
 */
export function listSupportedModels(providerType?: ProviderType): ModelRegistryEntry[] {
  const entries = Array.from(MODEL_REGISTRY.values())

  if (providerType) {
    return entries.filter((e) => e.provider === providerType)
  }

  return entries
}

/**
 * List supported models grouped by provider.
 */
export function listSupportedModelsGrouped(): Map<ProviderType, ModelRegistryEntry[]> {
  const grouped = new Map<ProviderType, ModelRegistryEntry[]>()

  for (const entry of MODEL_REGISTRY.values()) {
    const existing = grouped.get(entry.provider) ?? []
    existing.push(entry)
    grouped.set(entry.provider, existing)
  }

  return grouped
}

/**
 * Annotate a list of runtime-discovered models (from adapter.listModels())
 * against the registry. Returns models with their matched registry entry,
 * tier, and display name.
 *
 * Supported models appear with their registry metadata.
 * Unrecognized models are marked as experimental.
 */
export function matchDetectedModels(
  detectedModels: ModelInfo[],
  providerType: ProviderType,
) {
  return annotateDetectedModels(detectedModels, providerType)
}
