import { describe, it, expect } from 'vitest'
import { calculateAdaptiveChunkSize, estimateAvgCueTokens } from '../chunking/adaptive-chunk-calculator.js'
import type { SubtitleDocument } from '@srtora/types'

describe('calculateAdaptiveChunkSize', () => {
  const baseParams = {
    contextWindow: null as number | null,
    avgCueTokens: 20,
    lookbehind: 3,
    lookahead: 3,
    contextUsageTarget: 0.6,
    outputStrategy: 'structured' as const,
  }

  it('returns clamped minimum with unknown context window', () => {
    const result = calculateAdaptiveChunkSize(baseParams)
    // With 4096 * 0.6 = 2457 available
    // Overhead: 400 + 200 + 100 + (6 * 20) = 820
    // Target budget: 2457 - 820 = 1637
    // Input budget: 1637 * 0.6 = 982
    // Chunk size: floor(982 / 20) = 49
    expect(result).toBeGreaterThanOrEqual(4)
    expect(result).toBeLessThanOrEqual(50)
  })

  it('returns larger chunk size with large context window', () => {
    const smallCtx = calculateAdaptiveChunkSize({ ...baseParams, contextWindow: 4096 })
    const largeCtx = calculateAdaptiveChunkSize({ ...baseParams, contextWindow: 128000 })
    expect(largeCtx).toBeGreaterThanOrEqual(smallCtx)
  })

  it('returns 50 (max) for very large context windows', () => {
    const result = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 1048576,
    })
    expect(result).toBe(50)
  })

  it('returns minimum chunk size for tiny context windows', () => {
    const result = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 512,
    })
    expect(result).toBe(4) // clamped to minimum
  })

  it('gives larger chunks for prompted vs structured (less overhead)', () => {
    const structured = calculateAdaptiveChunkSize({ ...baseParams, contextWindow: 4096 })
    const prompted = calculateAdaptiveChunkSize({ ...baseParams, contextWindow: 4096, outputStrategy: 'prompted' })
    expect(prompted).toBeGreaterThanOrEqual(structured)
  })

  it('reduces chunk size when context cues are large', () => {
    const smallContext = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 8192,
      lookbehind: 2,
      lookahead: 1,
    })
    const largeContext = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 8192,
      lookbehind: 7,
      lookahead: 5,
    })
    expect(smallContext).toBeGreaterThanOrEqual(largeContext)
  })

  it('handles higher usage targets with larger chunks', () => {
    const low = calculateAdaptiveChunkSize({ ...baseParams, contextWindow: 8192, contextUsageTarget: 0.3 })
    const high = calculateAdaptiveChunkSize({ ...baseParams, contextWindow: 8192, contextUsageTarget: 0.8 })
    expect(high).toBeGreaterThanOrEqual(low)
  })

  it('handles zero avgCueTokens gracefully', () => {
    const result = calculateAdaptiveChunkSize({ ...baseParams, avgCueTokens: 0 })
    expect(result).toBeGreaterThanOrEqual(4)
  })

  it('uses raw strategy with no schema overhead', () => {
    const result = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 8192,
      outputStrategy: 'raw',
    })
    const structured = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 8192,
      outputStrategy: 'structured',
    })
    expect(result).toBeGreaterThanOrEqual(structured)
  })
})

describe('estimateAvgCueTokens', () => {
  it('returns default for empty document', () => {
    const doc: SubtitleDocument = {
      format: 'srt',
      sourceFilename: 'test.srt',
      cues: [],
      cueCount: 0,
    }
    expect(estimateAvgCueTokens(doc)).toBe(20)
  })

  it('estimates tokens from character count', () => {
    const doc: SubtitleDocument = {
      format: 'srt',
      sourceFilename: 'test.srt',
      cues: [
        { sequence: 1, startMs: 0, endMs: 1000, rawText: 'Hello world', textLines: ['Hello world'], plainText: 'Hello world', inlineTags: [] },
        { sequence: 2, startMs: 1000, endMs: 2000, rawText: 'How are you', textLines: ['How are you'], plainText: 'How are you', inlineTags: [] },
      ],
      cueCount: 2,
    }
    const result = estimateAvgCueTokens(doc)
    // avg chars = 11, / 4 = 2.75, ceil = 3, but min is 5
    expect(result).toBe(5)
  })

  it('handles longer subtitle lines', () => {
    const longText = 'This is a much longer subtitle line that contains more characters and will result in higher token estimates'
    const doc: SubtitleDocument = {
      format: 'srt',
      sourceFilename: 'test.srt',
      cues: [
        { sequence: 1, startMs: 0, endMs: 1000, rawText: longText, textLines: [longText], plainText: longText, inlineTags: [] },
      ],
      cueCount: 1,
    }
    const result = estimateAvgCueTokens(doc)
    // 107 chars / 4 = 26.75, ceil = 27
    expect(result).toBeGreaterThan(20)
  })
})
