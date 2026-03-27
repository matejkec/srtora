import { PipelineException } from '@srtora/types'

export interface RetryOptions {
  maxRetries: number
  baseDelayMs?: number
  maxDelayMs?: number
  signal?: AbortSignal
}

/**
 * Retry with exponential backoff and jitter.
 * Respects AbortSignal for cancellation.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs = 1000, maxDelayMs = 30000, signal } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new PipelineException({
        code: 'CANCELLED',
        message: 'Operation cancelled',
        recoverable: false,
      })
    }

    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (error instanceof PipelineException && error.error.code === 'CANCELLED') {
        throw error
      }
      if (signal?.aborted) {
        throw new PipelineException({
          code: 'CANCELLED',
          message: 'Operation cancelled',
          recoverable: false,
        })
      }
      if (error instanceof PipelineException && !error.error.recoverable) {
        throw error
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
        const jitteredDelay = delay * (0.5 + Math.random() * 0.5)
        await sleep(jitteredDelay, signal)
      }
    }
  }

  throw lastError
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new PipelineException({ code: 'CANCELLED', message: 'Operation cancelled', recoverable: false }),
      )
      return
    }

    const timer = setTimeout(resolve, ms)

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(
          new PipelineException({ code: 'CANCELLED', message: 'Operation cancelled', recoverable: false }),
        )
      },
      { once: true },
    )
  })
}
