import type { ModelInfo, ProviderConfig } from '@srtora/types'
import { PipelineException } from '@srtora/types'
import type { LLMAdapter, ChatRequest, ChatResponse } from './types.js'

interface OllamaGenerateResponse {
  model: string
  response: string
  done: boolean
}

interface OllamaTagsResponse {
  models: Array<{
    name: string
    model: string
    size: number
    details: {
      family: string
      parameter_size: string
      quantization_level: string
    }
  }>
}

interface OllamaChatResponse {
  model: string
  message: {
    role: string
    content: string
  }
  done: boolean
  done_reason?: string
  prompt_eval_count?: number
  eval_count?: number
}

export class OllamaAdapter implements LLMAdapter {
  private baseUrl: string

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const ollamaMessages = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const body: Record<string, unknown> = {
      model: request.model,
      messages: ollamaMessages,
      stream: false,
    }

    if (request.maxTokens) {
      body.options = { num_predict: request.maxTokens }
    }

    // Use Ollama's native format field for structured JSON output
    if (request.jsonSchema) {
      body.format = request.jsonSchema
    }

    const response = await this.fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: request.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error')
      throw new PipelineException({
        code: response.status === 404 ? 'MODEL_NOT_FOUND' : 'PROVIDER_UNREACHABLE',
        message: `Ollama chat failed (${response.status}): ${text}`,
        details: text,
        recoverable: response.status >= 500,
        suggestion:
          response.status === 404
            ? 'Make sure the model is pulled. Run: ollama pull <model>'
            : 'Check that Ollama is running and accessible.',
      })
    }

    const data = (await response.json()) as OllamaChatResponse

    return {
      content: data.message.content,
      finishReason: data.done_reason === 'stop' || data.done ? 'stop' : 'length',
      usage: {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
      },
    }
  }

  async complete(
    model: string,
    prompt: string,
    maxTokens?: number,
    stop?: string[],
    signal?: AbortSignal,
  ): Promise<string> {
    const body: Record<string, unknown> = { model, prompt, stream: false }
    if (maxTokens) body.options = { num_predict: maxTokens }
    if (stop?.length) body.stop = stop

    const response = await this.fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error')
      throw new PipelineException({
        code: response.status === 404 ? 'MODEL_NOT_FOUND' : 'PROVIDER_UNREACHABLE',
        message: `Generate request failed (${response.status}): ${text}`,
        recoverable: response.status >= 500,
      })
    }

    const data = (await response.json()) as OllamaGenerateResponse
    return data.response
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.fetch('/api/tags', { method: 'GET' })

    if (!response.ok) {
      throw new PipelineException({
        code: 'PROVIDER_UNREACHABLE',
        message: `Failed to list Ollama models (${response.status})`,
        recoverable: true,
      })
    }

    const data = (await response.json()) as OllamaTagsResponse

    return data.models.map((m) => ({
      id: m.name,
      name: m.name,
      providerId: 'ollama' as const,
      parameterSize: m.details?.parameter_size,
      quantization: m.details?.quantization_level,
      family: m.details?.family,
      supportsStructuredOutput: true,
      supportsStreaming: true,
    }))
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await this.fetch('/api/tags', { method: 'GET' })
      if (response.ok) {
        return { ok: true }
      }
      return { ok: false, error: `HTTP ${response.status}` }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  private fetch(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
  }
}
