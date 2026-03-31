import type { PromptStrategy, ChatMessage } from './types.js'

/**
 * Strategy for models that don't support system messages.
 * Combines system + user content into a single user message.
 *
 * Used by: Gemma 3 family, TranslateGemma, and any model where
 * the execution profile sets promptStyleId = 'no-system-role'.
 */
export class NoSystemRoleStrategy implements PromptStrategy {
  formatMessages(systemContent: string, userContent: string): ChatMessage[] {
    return [
      {
        role: 'user',
        content: `${systemContent}\n\n---\n\n${userContent}`,
      },
    ]
  }
}

/**
 * @deprecated Use NoSystemRoleStrategy instead. Kept as alias for backward compatibility.
 */
export const GemmaStrategy = NoSystemRoleStrategy
