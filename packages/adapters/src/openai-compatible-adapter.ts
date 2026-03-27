import type { ModelInfo, ProviderConfig } from '@srtora/types'
import { PipelineException } from '@srtora/types'
import type { LLMAdapter, ChatRequest, ChatResponse } from './types.js'

interface OpenAICompletionResponse {
  choices: Array<{
    text: string
    finish_reason: string
  }>
}

interface OpenAIChatResponse {
  choices: Array<{
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenAIModelsResponse {
  data: Array<{
    id: string
    owned_by?: string
  }>
}

export class OpenAICompatibleAdapter implements LLMAdapter {
  private baseUrl: string
  private apiKey?: string
  private providerId: 'openai-compatible' | 'openai' | 'anthropic' | 'google'

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.apiKey = config.apiKey
    this.providerId = config.type as 'openai-compatible' | 'openai' | 'anthropic' | 'google'
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    let body: Record<string, unknown>

    if (request.rawBody) {
      // Raw body override for non-standard APIs (e.g. TranslateGemma)
      body = { ...request.rawBody }
    } else {
      const messages = request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      body = {
        model: request.model,
        messages,
      }

      if (request.maxTokens) {
        body.max_tokens = request.maxTokens
      }

      // Only send response_format when using structured output strategy
      // For 'prompted' mode, JSON instructions are in the prompt text
      // For 'raw' mode, no JSON handling at all
      const effectiveStrategy = request.outputStrategy ?? (request.jsonSchema ? 'structured' : undefined)
      if (request.jsonSchema && effectiveStrategy === 'structured') {
        body.response_format = {
          type: 'json_schema',
          json_schema: {
            name: 'translation_output',
            strict: true,
            schema: request.jsonSchema,
          },
        }
      }
    }

    const response = await this.fetch('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: request.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error')
      const code =
        response.status === 401 || response.status === 403
          ? 'PROVIDER_AUTH_ERROR'
          : response.status === 429
            ? 'PROVIDER_RATE_LIMIT'
            : response.status === 404
              ? 'MODEL_NOT_FOUND'
              : 'PROVIDER_UNREACHABLE'

      throw new PipelineException({
        code,
        message: `API request failed (${response.status}): ${text}`,
        details: text,
        recoverable: response.status === 429 || response.status >= 500,
        suggestion:
          response.status === 401 ? 'Check your API key.' :
          response.status === 429 ? 'Rate limited. The request will be retried.' :
          'Check that the API endpoint is correct and reachable.',
      })
    }

    const data = (await response.json()) as OpenAIChatResponse
    const choice = data.choices[0]

    if (!choice) {
      throw new PipelineException({
        code: 'STRUCTURED_OUTPUT_FAIL',
        message: 'No response from model',
        recoverable: true,
      })
    }

    return {
      content: choice.message.content,
      finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    }
  }

  async complete(
    model: string,
    prompt: string,
    maxTokens?: number,
    stop?: string[],
    signal?: AbortSignal,
  ): Promise<string> {
    const body: Record<string, unknown> = { model, prompt }
    if (maxTokens) body.max_tokens = maxTokens
    if (stop?.length) body.stop = stop

    const response = await this.fetch('/v1/completions', {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error')
      throw new PipelineException({
        code: response.status === 404 ? 'MODEL_NOT_FOUND' : 'PROVIDER_UNREACHABLE',
        message: `Completions request failed (${response.status}): ${text}`,
        recoverable: response.status >= 500,
      })
    }

    const data = (await response.json()) as OpenAICompletionResponse
    const choice = data.choices[0]
    if (!choice) {
      throw new PipelineException({
        code: 'STRUCTURED_OUTPUT_FAIL',
        message: 'No completion returned from model',
        recoverable: true,
      })
    }
    return choice.text
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.fetch('/v1/models', { method: 'GET' })

    if (!response.ok) {
      throw new PipelineException({
        code: 'PROVIDER_UNREACHABLE',
        message: `Failed to list models (${response.status})`,
        recoverable: true,
      })
    }

    const data = (await response.json()) as OpenAIModelsResponse

    return data.data.map((m) => ({
      id: m.id,
      name: m.id,
      providerId: this.providerId,
      supportsStructuredOutput: true,
      supportsStreaming: true,
    }))
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await this.fetch('/v1/models', { method: 'GET' })
      if (response.ok) {
        return { ok: true }
      }
      const text = await response.text().catch(() => '')
      return { ok: false, error: `HTTP ${response.status}: ${text}` }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  private fetch(path: string, init: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers as Record<string, string>),
      },
    })
  }
}
