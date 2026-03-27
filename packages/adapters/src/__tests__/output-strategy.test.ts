import { describe, it, expect } from 'vitest'
import { augmentPromptForJson, prepareRequest, isStructuredOutputError } from '../output-strategy.js'
import type { ChatRequest } from '../types.js'

const sampleSchema = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'number' }, text: { type: 'string' } },
        required: ['id', 'text'],
      },
    },
  },
  required: ['translations'],
}

describe('augmentPromptForJson', () => {
  it('appends JSON instructions to prompt text', () => {
    const result = augmentPromptForJson('Translate these cues', sampleSchema)
    expect(result).toContain('Translate these cues')
    expect(result).toContain('IMPORTANT: You MUST respond with valid JSON only')
    expect(result).toContain('"translations"')
  })

  it('includes the schema in the output', () => {
    const result = augmentPromptForJson('Hello', sampleSchema)
    expect(result).toContain('"type": "object"')
  })
})

describe('prepareRequest', () => {
  const baseRequest: ChatRequest = {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a translator.' },
      { role: 'user', content: 'Translate this text.' },
    ],
    jsonSchema: sampleSchema,
    maxTokens: 4096,
  }

  it('passes jsonSchema through for structured strategy', () => {
    const result = prepareRequest(baseRequest, 'structured')
    expect(result.jsonSchema).toEqual(sampleSchema)
    expect(result.outputStrategy).toBe('structured')
    // Messages should be unchanged
    expect(result.messages[1]!.content).toBe('Translate this text.')
  })

  it('strips jsonSchema and augments prompt for prompted strategy', () => {
    const result = prepareRequest(baseRequest, 'prompted')
    expect(result.jsonSchema).toBeUndefined()
    expect(result.outputStrategy).toBe('prompted')
    // Last user message should have JSON instructions
    expect(result.messages[1]!.content).toContain('IMPORTANT: You MUST respond with valid JSON only')
    expect(result.messages[1]!.content).toContain('Translate this text.')
    // System message unchanged
    expect(result.messages[0]!.content).toBe('You are a translator.')
  })

  it('strips jsonSchema for raw strategy', () => {
    const result = prepareRequest(baseRequest, 'raw')
    expect(result.jsonSchema).toBeUndefined()
    expect(result.outputStrategy).toBe('raw')
    // Messages should be unchanged
    expect(result.messages[1]!.content).toBe('Translate this text.')
  })

  it('handles request without jsonSchema in prompted mode', () => {
    const { jsonSchema: _, ...noSchema } = baseRequest
    const result = prepareRequest(noSchema, 'prompted')
    expect(result.outputStrategy).toBe('prompted')
    expect(result.messages[1]!.content).toBe('Translate this text.')
  })

  it('does not mutate original request messages', () => {
    const original = baseRequest.messages[1]!.content
    prepareRequest(baseRequest, 'prompted')
    expect(baseRequest.messages[1]!.content).toBe(original)
  })
})

describe('isStructuredOutputError', () => {
  it('detects PipelineException with STRUCTURED_OUTPUT_FAIL code', () => {
    const error = { error: { code: 'STRUCTURED_OUTPUT_FAIL', message: 'Failed' } }
    expect(isStructuredOutputError(error)).toBe(true)
  })

  it('detects error messages mentioning json_schema', () => {
    const error = { error: { code: 'PROVIDER_UNREACHABLE', message: 'JSON mode is not enabled for models/gemma-3-27b-it' } }
    expect(isStructuredOutputError(error)).toBe(true)
  })

  it('detects error messages mentioning response_format', () => {
    const error = { error: { code: 'PROVIDER_UNREACHABLE', message: 'response_format is not supported' } }
    expect(isStructuredOutputError(error)).toBe(true)
  })

  it('detects Error instances mentioning structured output', () => {
    expect(isStructuredOutputError(new Error('structured output not supported'))).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    const error = { error: { code: 'PROVIDER_UNREACHABLE', message: 'Connection refused' } }
    expect(isStructuredOutputError(error)).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isStructuredOutputError(null)).toBe(false)
    expect(isStructuredOutputError(undefined)).toBe(false)
  })
})
