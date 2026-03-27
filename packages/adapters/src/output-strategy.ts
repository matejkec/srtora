import type { OutputStrategyType } from '@srtora/types'
import type { ChatRequest } from './types.js'

/**
 * Build a human-readable description of a JSON schema for inclusion in prompt text.
 * Used when the model doesn't support structured output and we need to ask for JSON via the prompt.
 */
function describeJsonSchema(schema: Record<string, unknown>): string {
  // Generate a compact JSON example from the schema
  return JSON.stringify(schema, null, 2)
}

/**
 * Augment prompt text with JSON format instructions.
 * Used when the output strategy is 'prompted' — the model doesn't support
 * native JSON schema enforcement, so we ask for JSON in the prompt.
 */
export function augmentPromptForJson(promptText: string, schema: Record<string, unknown>): string {
  const schemaDesc = describeJsonSchema(schema)

  return (
    promptText +
    '\n\n' +
    'IMPORTANT: You MUST respond with valid JSON only. No markdown fences, no explanations, no text outside the JSON.\n' +
    'Your response must conform to this JSON schema:\n' +
    '```json\n' +
    schemaDesc +
    '\n```'
  )
}

/**
 * Prepare a chat request based on the output strategy.
 *
 * - 'structured': pass jsonSchema to the API (current behavior for capable models)
 * - 'prompted': strip jsonSchema from the request, inject JSON instructions into the prompt text
 * - 'raw': no JSON handling at all (for TranslateGemma-like models)
 */
export function prepareRequest(
  request: ChatRequest,
  strategy: OutputStrategyType,
): ChatRequest {
  if (strategy === 'structured') {
    // Pass jsonSchema through as-is — the adapter will send it via response_format/format
    return { ...request, outputStrategy: 'structured' }
  }

  if (strategy === 'raw') {
    // No JSON handling — strip jsonSchema
    const { jsonSchema: _schema, ...rest } = request
    return { ...rest, outputStrategy: 'raw' }
  }

  // 'prompted': remove jsonSchema from the API request, augment last user message instead
  if (!request.jsonSchema) {
    return { ...request, outputStrategy: 'prompted' }
  }

  const messages = [...request.messages]
  const lastIdx = messages.length - 1

  if (lastIdx >= 0 && messages[lastIdx]!.role === 'user') {
    messages[lastIdx] = {
      ...messages[lastIdx]!,
      content: augmentPromptForJson(messages[lastIdx]!.content, request.jsonSchema),
    }
  } else if (lastIdx >= 0) {
    // If the last message isn't from the user, find the last user message
    for (let i = lastIdx; i >= 0; i--) {
      if (messages[i]!.role === 'user') {
        messages[i] = {
          ...messages[i]!,
          content: augmentPromptForJson(messages[i]!.content, request.jsonSchema),
        }
        break
      }
    }
  }

  const { jsonSchema: _schema, ...rest } = request
  return { ...rest, messages, outputStrategy: 'prompted' }
}

/**
 * Check if an error response indicates a structured output failure
 * that should trigger a fallback to prompted mode.
 */
export function isStructuredOutputError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  // Check PipelineException
  if ('error' in error) {
    const pipelineError = (error as { error: { code?: string; message?: string; details?: string } }).error
    if (pipelineError?.code === 'STRUCTURED_OUTPUT_FAIL') return true

    const message = (pipelineError?.message ?? '') + (pipelineError?.details ?? '')
    return /json.mode|json_schema|response_format|structured.output/i.test(message)
  }

  // Check plain Error
  if (error instanceof Error) {
    return /json.mode|json_schema|response_format|structured.output/i.test(error.message)
  }

  return false
}
