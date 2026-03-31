import type { ModelRegistryEntry } from '@srtora/types'
import { OPENAI_MODELS } from './profiles/openai.js'
import { GOOGLE_MODELS } from './profiles/google.js'
import { ANTHROPIC_MODELS } from './profiles/anthropic.js'
import { OLLAMA_MODELS } from './profiles/ollama.js'

/**
 * The canonical model registry.
 *
 * Maps model IDs to their full registry entries. This is the single source
 * of truth for all officially supported models in SRTora.
 *
 * To add a new supported model:
 * 1. Add its entry to the appropriate profiles/ file
 * 2. The entry will automatically appear in this registry
 * 3. No other code changes needed — the orchestrator reads from this registry
 */
export const MODEL_REGISTRY: ReadonlyMap<string, ModelRegistryEntry> = new Map([
  ...OPENAI_MODELS,
  ...GOOGLE_MODELS,
  ...ANTHROPIC_MODELS,
  ...OLLAMA_MODELS,
])
