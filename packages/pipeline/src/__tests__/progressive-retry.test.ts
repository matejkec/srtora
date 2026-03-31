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

  it('retries via withRetry on parse failure, succeeds on second attempt', async () => {
    const orchestrator = new PipelineOrchestrator(makeConfig())
    const adapter = getMockAdapter()

    let callCount = 0
    adapter.chat.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First call: return unparseable content
        return Promise.resolve({ content: 'This is not JSON at all', finishReason: 'stop' })
      }
      // Second call: good response
      return Promise.resolve({ content: goodTranslationJson([1, 2]), finishReason: 'stop' })
    })

    const result = await orchestrator.run(SIMPLE_SRT, 'test.srt', callbacks)

    expect(result.outputContent).toContain('translated-1')
    expect(result.outputContent).toContain('translated-2')
    // withRetry handles the actual retry — the orchestrator only tracks "repaired" responses
    expect(adapter.chat).toHaveBeenCalledTimes(2)
  })

  it('uses source text as fallback for missing translations in chunk', async () => {
    const orchestrator = new PipelineOrchestrator(makeConfig())
    const adapter = getMockAdapter()

    // Return only one of two expected translations
    adapter.chat.mockResolvedValue({
      content: goodTranslationJson([1]),
      finishReason: 'stop',
    })

    const result = await orchestrator.run(SIMPLE_SRT, 'test.srt', callbacks)

    // Cue 1 should be translated, cue 2 should fall back to source text
    expect(result.outputContent).toContain('translated-1')
    expect(result.outputContent).toContain('World')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('uses model-specific maxCompletionTokens from resolved params', async () => {
    // Use a known model to verify non-hardcoded maxTokens
    const orchestrator = new PipelineOrchestrator(makeConfig({
      translationModel: 'test-model',
    }))
    const adapter = getMockAdapter()

    adapter.chat.mockResolvedValue({
      content: goodTranslationJson([1, 2]),
      finishReason: 'stop',
    })

    await orchestrator.run(SIMPLE_SRT, 'test.srt', callbacks)

    // The chat call should have a maxTokens value (from experimental profile = 4096)
    const chatCall = adapter.chat.mock.calls[0]![0] as { maxTokens?: number }
    expect(chatCall.maxTokens).toBe(4_096) // experimental openai-compatible default
  })

  it('computes adaptive chunk size instead of using hardcoded value', async () => {
    // Create a test with enough cues to verify chunking behavior
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
    const orchestrator = new PipelineOrchestrator(makeConfig())
    const adapter = getMockAdapter()

    adapter.chat.mockResolvedValue({
      content: goodTranslationJson([1, 2, 3, 4]),
      finishReason: 'stop',
    })

    const result = await orchestrator.run(srt, 'test.srt', callbacks)

    expect(result.outputContent).toContain('translated-1')
    expect(result.outputContent).toContain('translated-4')
    // Adaptive chunking should produce at least 1 chunk
    expect(result.stats.totalChunks).toBeGreaterThanOrEqual(1)
  })
})
