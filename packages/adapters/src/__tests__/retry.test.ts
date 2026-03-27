import { describe, it, expect } from 'vitest'
import { PipelineException } from '@srtora/types'
import { withRetry } from '../retry.js'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const result = await withRetry(async () => 42, { maxRetries: 3 })
    expect(result).toBe(42)
  })

  it('retries on recoverable errors', async () => {
    let attempts = 0
    const result = await withRetry(
      async () => {
        attempts++
        if (attempts < 3) {
          throw new PipelineException({
            code: 'PROVIDER_UNREACHABLE',
            message: 'fail',
            recoverable: true,
          })
        }
        return 'success'
      },
      { maxRetries: 3, baseDelayMs: 10 },
    )
    expect(result).toBe('success')
    expect(attempts).toBe(3)
  })

  it('throws immediately on non-recoverable errors', async () => {
    let attempts = 0
    await expect(
      withRetry(
        async () => {
          attempts++
          throw new PipelineException({
            code: 'MODEL_NOT_FOUND',
            message: 'Not found',
            recoverable: false,
          })
        },
        { maxRetries: 3, baseDelayMs: 10 },
      ),
    ).rejects.toThrow()
    expect(attempts).toBe(1)
  })

  it('throws after max retries exhausted', async () => {
    let attempts = 0
    await expect(
      withRetry(
        async () => {
          attempts++
          throw new PipelineException({
            code: 'PROVIDER_UNREACHABLE',
            message: 'fail',
            recoverable: true,
          })
        },
        { maxRetries: 2, baseDelayMs: 10 },
      ),
    ).rejects.toThrow()
    expect(attempts).toBe(3) // initial + 2 retries
  })

  it('respects AbortSignal cancellation', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      withRetry(async () => 'never', {
        maxRetries: 3,
        signal: controller.signal,
      }),
    ).rejects.toThrow()
  })

  it('re-throws CANCELLED errors immediately', async () => {
    let attempts = 0
    await expect(
      withRetry(
        async () => {
          attempts++
          throw new PipelineException({
            code: 'CANCELLED',
            message: 'cancelled',
            recoverable: false,
          })
        },
        { maxRetries: 3, baseDelayMs: 10 },
      ),
    ).rejects.toThrow()
    expect(attempts).toBe(1)
  })
})
