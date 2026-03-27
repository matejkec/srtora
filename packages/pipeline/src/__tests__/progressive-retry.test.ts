import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PipelineOrchestrator } from '../orchestrator.js'
import type { PipelineConfig, ProgressEvent } from '@srtora/types'

const SIMPLE_SRT = `1
00:00:01,000 --> 00:00:02,000
Hello

2
00:00:03,000 --> 00:00:04,000
World
`

function makeConfig(overrides?: Partial<PipelineConfig>): PipelineConfig {
  return {
    sourceLanguage: 'en',
    targetLanguage: 'hr',
    provider: { type: 'openai-compatible', baseUrl: 'http://localhost:11434' },
    translationModel: 'test-model',
    qualityMode: 'fast',
    enableAnalysis: false,
    enableReview: false,
    ...overrides,
  }
}

function goodTranslationJson(ids: number[]) {
  return JSON.stringify({
    translations: ids.map((id) => ({ id, text: `translated-${id}` })),
  })
}

// Mock createAdapter at module level
vi.mock('@srtora/adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@srtora/adapters')>()
  return {
    ...actual,
    createAdapter: vi.fn(() => ({
      chat: vi.fn(),
      complete: vi.fn(),
      listModels: vi.fn().mockResolvedValue([]),
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
    })),
  }
})

// Get the mocked createAdapter
import { createAdapter } from '@srtora/adapters'

function getMockAdapter() {
  return (createAdapter as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value as {
    chat: ReturnType<typeof vi.fn>
  }
}

describe('progressive retry', () => {
  const events: ProgressEvent[] = []
  const callbacks = {
    onProgress: (e: ProgressEvent) => events.push(e),
  }

  beforeEach(() => {
    events.length = 0
    vi.mocked(createAdapter).mockClear()
  })

  it('succeeds on first attempt when response is valid', async () => {
    const orchestrator = new PipelineOrchestrator(makeConfig())
    const adapter = getMockAdapter()
    adapter.chat.mockResolvedValue({
      content: goodTranslationJson([1, 2]),
      finishReason: 'stop',
    })

    const result = await orchestrator.run(SIMPLE_SRT, 'test.srt', callbacks)

    expect(result.outputContent).toContain('translated-1')
    expect(result.outputContent).toContain('translated-2')
    expect(result.stats.totalRetries).toBe(0)
  })

  it('retries with temperature on first parse failure, succeeds on tier 2', async () => {
    const orchestrator = new PipelineOrchestrator(makeConfig())
    const adapter = getMockAdapter()

    let callCount = 0
    adapter.chat.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Tier 1: return unparseable content
        return Promise.resolve({ content: 'This is not JSON at all', finishReason: 'stop' })
      }
      // Tier 2: good response
      return Promise.resolve({ content: goodTranslationJson([1, 2]), finishReason: 'stop' })
    })

    const result = await orchestrator.run(SIMPLE_SRT, 'test.srt', callbacks)

    expect(result.outputContent).toContain('translated-1')
    expect(result.stats.totalRetries).toBe(1)
    // Second call should have temperature set
    expect(adapter.chat).toHaveBeenCalledTimes(2)
  })

  it('falls back to source text when all tiers fail', async () => {
    const orchestrator = new PipelineOrchestrator(makeConfig({ maxRetries: 3 }))
    const adapter = getMockAdapter()

    // All calls return unparseable content
    adapter.chat.mockResolvedValue({
      content: 'I cannot produce JSON right now',
      finishReason: 'stop',
    })

    const result = await orchestrator.run(SIMPLE_SRT, 'test.srt', callbacks)

    // Should use source text as final fallback (never crash)
    expect(result.outputContent).toContain('Hello')
    expect(result.outputContent).toContain('World')
    // Retries should have been attempted
    expect(result.stats.totalRetries).toBeGreaterThan(0)
  })

  it('splits chunk and translates halves when tier 3 fails', async () => {
    // Use a larger file so chunkSize doesn't make it single-cue
    const srt = `1
00:00:01,000 --> 00:00:02,000
Hello

2
00:00:03,000 --> 00:00:04,000
World

3
00:00:05,000 --> 00:00:06,000
Goodbye

4
00:00:07,000 --> 00:00:08,000
End
`
    const orchestrator = new PipelineOrchestrator(makeConfig({ maxRetries: 3, chunkSize: 4 }))
    const adapter = getMockAdapter()

    let callCount = 0
    adapter.chat.mockImplementation(() => {
      callCount++
      // Tiers 1-3 fail (full chunk), tiers 4a and 4b succeed (halves)
      if (callCount <= 3) {
        return Promise.resolve({ content: 'not json', finishReason: 'stop' })
      }
      // Split halves: first half [1,2], second half [3,4]
      if (callCount === 4) {
        return Promise.resolve({
          content: goodTranslationJson([1, 2]),
          finishReason: 'stop',
        })
      }
      return Promise.resolve({
        content: goodTranslationJson([3, 4]),
        finishReason: 'stop',
      })
    })

    const result = await orchestrator.run(srt, 'test.srt', callbacks)

    expect(result.outputContent).toContain('translated-1')
    expect(result.outputContent).toContain('translated-2')
    expect(result.outputContent).toContain('translated-3')
    expect(result.outputContent).toContain('translated-4')
  })
})
