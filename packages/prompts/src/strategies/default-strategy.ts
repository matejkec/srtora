import type { PromptStrategy, ChatMessage } from './types.js'

export class DefaultStrategy implements PromptStrategy {
  formatMessages(systemContent: string, userContent: string): ChatMessage[] {
    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ]
  }
}
