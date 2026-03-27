export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface PromptStrategy {
  formatMessages(systemContent: string, userContent: string): ChatMessage[]
}
