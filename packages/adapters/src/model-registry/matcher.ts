import type { ModelRegistryEntry, ModelInfo, ProviderType, ModelSupportTier, MatchType } from '@srtora/types'
import { MODEL_REGISTRY } from './registry-data.js'

export interface MatchResult {
  entry: ModelRegistryEntry
  tier: ModelSupportTier
  matchType: MatchType
}

/**
 * Normalize a model ID for matching.
 *
 * Strips common path prefixes (e.g., "mlx-community/gemma-3-12b-it" → "gemma-3-12b-it")
 * and Ollama tag suffixes (e.g., "gemma3:4b-instruct-q4_0" → "gemma3:4b").
 */
function normalizeModelId(modelId: string): string {
  // Strip path prefixes (MLX community models, etc.)
  let id = modelId.includes('/') ? modelId.split('/').pop()! : modelId
  return id.toLowerCase()
}

/**
 * Extract the base Ollama model name and size indicator.
 * "gemma3:4b-instruct-q4_0" → "gemma3:4b"
 * "translategemma:12b-it" → "translategemma:12b"
 */
function extractOllamaBase(modelId: string): string {
  const normalized = normalizeModelId(modelId)
  // Match "name:sizeX" pattern and strip everything after
  const match = normalized.match(/^([^:]+:\d+b)/)
  if (match) return match[1]!
  return normalized
}

/**
 * Look up a model in the registry by its ID.
 *
 * Matching strategy (first match wins):
 * 1. Exact match by canonical ID
 * 2. Ollama family match (compare ollamaFamily against model family metadata or normalized name)
 * 3. Regex pattern match via matchPatterns
 *
 * Returns null if no match found (model is experimental).
 */
export function matchModel(
  modelId: string,
  providerType: ProviderType,
  ollamaFamily?: string,
): MatchResult | null {
  const normalized = normalizeModelId(modelId)
  const ollamaBase = extractOllamaBase(modelId)

  // 1. Exact match by canonical ID
  const exact = MODEL_REGISTRY.get(modelId) ?? MODEL_REGISTRY.get(normalized) ?? MODEL_REGISTRY.get(ollamaBase)
  if (exact && exact.provider === providerType) {
    return { entry: exact, tier: 'supported', matchType: 'exact' }
  }

  // For non-Ollama providers, also try without provider match
  // (cloud models always have deterministic IDs)
  if (exact && providerType !== 'ollama') {
    return { entry: exact, tier: 'supported', matchType: 'exact' }
  }

  // 2. Ollama family match (only applies when querying Ollama models)
  if (ollamaFamily && providerType === 'ollama') {
    for (const entry of MODEL_REGISTRY.values()) {
      if (entry.provider !== 'ollama') continue
      if (!entry.ollamaFamily) continue

      if (entry.ollamaFamily === ollamaFamily.toLowerCase()) {
        // Family matched. Now try to find the best size match.
        return findBestSizeMatch(entry, modelId, ollamaFamily) ?? {
          entry,
          tier: 'supported',
          matchType: 'family',
        }
      }
    }
  }

  // 3. Regex pattern match
  for (const entry of MODEL_REGISTRY.values()) {
    if (!entry.matchPatterns) continue

    for (const pattern of entry.matchPatterns) {
      const regex = new RegExp(pattern, 'i')
      if (regex.test(modelId) || regex.test(normalized) || regex.test(ollamaBase)) {
        return { entry, tier: 'supported', matchType: 'pattern' }
      }
    }
  }

  return null
}

/**
 * Find the best size-specific registry entry for a family match.
 * E.g., if detected model is "gemma3:12b-instruct-q4_0" and registry has entries
 * for gemma3:4b and gemma3:12b, match the 12b entry.
 */
function findBestSizeMatch(
  _familyEntry: ModelRegistryEntry,
  modelId: string,
  _ollamaFamily: string,
): MatchResult | null {
  const normalized = normalizeModelId(modelId)

  // Extract size from the model ID (e.g., "14b", "70b", "8b")
  const sizeMatch = normalized.match(/(\d+b)/)
  if (!sizeMatch) return null

  const size = sizeMatch[1]!

  // Look for an exact size match in the registry
  for (const entry of MODEL_REGISTRY.values()) {
    if (entry.provider !== 'ollama') continue
    if (!entry.matchPatterns) continue

    for (const pattern of entry.matchPatterns) {
      const regex = new RegExp(pattern, 'i')
      if (regex.test(normalized)) {
        return { entry, tier: 'supported', matchType: 'pattern' }
      }
    }

    // Also check if the entry ID contains the size
    if (entry.id.includes(size) && entry.ollamaFamily === _familyEntry.ollamaFamily) {
      return { entry, tier: 'supported', matchType: 'family' }
    }
  }

  return null
}

/**
 * Annotate a list of detected models (from adapter.listModels()) against the registry.
 */
export interface AnnotatedModel {
  modelInfo: ModelInfo
  registryEntry: ModelRegistryEntry | null
  tier: ModelSupportTier
  matchType: MatchType | null
  displayName: string
}

export function annotateDetectedModels(
  detectedModels: ModelInfo[],
  providerType: ProviderType,
): AnnotatedModel[] {
  return detectedModels.map((model) => {
    const match = matchModel(model.id, providerType, model.family)

    if (match) {
      return {
        modelInfo: model,
        registryEntry: match.entry,
        tier: match.tier,
        matchType: match.matchType,
        displayName: match.entry.displayName,
      }
    }

    return {
      modelInfo: model,
      registryEntry: null,
      tier: 'experimental' as const,
      matchType: null,
      displayName: model.name,
    }
  })
}
