import type { ModelInfo, OutputStrategyType } from '@srtora/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  /** JSON schema for structured output (if supported) */
  jsonSchema?: Record<string, unknown>
  /** Maximum tokens for the completion. Prevents truncation on servers with low defaults. */
  maxTokens?: number
  /** Override the entire request body (for non-standard APIs like TranslateGemma) */
  rawBody?: Record<string, unknown>
  /** Output strategy: controls whether jsonSchema is sent as API param or as prompt text */
  outputStrategy?: OutputStrategyType
  signal?: AbortSignal
}

export interface ChatResponse {
  content: string
  finishReason: 'stop' | 'length' | 'error'
  /** Token usage if available */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface LLMAdapter {
  /** Send a chat completion request */
  chat(request: ChatRequest): Promise<ChatResponse>
  /** Send a raw text completion request (used for models like TranslateGemma that need pre-built prompts) */
  complete(model: string, prompt: string, maxTokens?: number, stop?: string[], signal?: AbortSignal): Promise<string>
  /** List available models from the provider */
  listModels(): Promise<ModelInfo[]>
  /** Test connectivity to the provider */
  testConnection(): Promise<{ ok: boolean; error?: string }>
}
