import type { PromptStrategy, ChatMessage } from './types.js'

/**
 * Strategy for models that don't support system messages (e.g., TranslateGemma).
 * Combines system + user content into a single user message.
 */
export class GemmaStrategy implements PromptStrategy {
  formatMessages(systemContent: string, userContent: string): ChatMessage[] {
    return [
      {
        role: 'user',
        content: `${systemContent}\n\n---\n\n${userContent}`,
      },
    ]
  }
}
