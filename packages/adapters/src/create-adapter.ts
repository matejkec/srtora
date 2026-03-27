import type { ProviderConfig } from '@srtora/types'
import type { LLMAdapter } from './types.js'
import { OllamaAdapter } from './ollama-adapter.js'
import { OpenAICompatibleAdapter } from './openai-compatible-adapter.js'

/**
 * Factory function to create the correct adapter for a provider config.
 */
export function createAdapter(config: ProviderConfig): LLMAdapter {
  switch (config.type) {
    case 'ollama':
      return new OllamaAdapter(config)
    case 'openai-compatible':
    case 'openai':
    case 'anthropic':
    case 'google':
      return new OpenAICompatibleAdapter(config)
    default:
      throw new Error(`Unknown provider type: ${config.type}`)
  }
}
