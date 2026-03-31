import type { PromptStyleId } from '@srtora/types'
import type { PromptStrategy } from './types.js'
import { DefaultStrategy } from './default-strategy.js'
import { NoSystemRoleStrategy } from './gemma-strategy.js'

/**
 * Create a prompt strategy from a PromptStyleId.
 *
 * The prompt style is determined by the model's execution profile
 * and controls how system + user content are formatted into messages.
 *
 * - 'default': System + user messages (most models)
 * - 'no-system-role': Single user message with merged system content (Gemma, etc.)
 * - 'raw-completion': Returns default strategy (not used for chat — TranslateGemma
 *   uses /v1/completions directly, but when called, default format is safe)
 */
export function createPromptStrategy(id: PromptStyleId): PromptStrategy {
  switch (id) {
    case 'default':
      return new DefaultStrategy()
    case 'no-system-role':
      return new NoSystemRoleStrategy()
    case 'raw-completion':
      // raw-completion models don't use chat prompts, but if they do,
      // NoSystemRoleStrategy is the safest fallback
      return new NoSystemRoleStrategy()
    default: {
      const _exhaustive: never = id
      throw new Error(`Unknown prompt style: ${_exhaustive}`)
    }
  }
}
