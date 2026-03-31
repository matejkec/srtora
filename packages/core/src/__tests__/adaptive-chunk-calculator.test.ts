import { describe, it, expect } from 'vitest'
import { calculateAdaptiveChunkSize, calculateAdaptiveChunkBudget, estimateAvgCueTokens } from '../chunking/adaptive-chunk-calculator.js'
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

  it('returns a valid chunk size with unknown context window', () => {
    const result = calculateAdaptiveChunkSize(baseParams)
    expect(result).toBeGreaterThanOrEqual(4)
    expect(result).toBeLessThanOrEqual(100) // default max (no totalCues)
  })

  it('returns larger chunk size with large context window', () => {
    const smallCtx = calculateAdaptiveChunkSize({ ...baseParams, contextWindow: 4096 })
    const largeCtx = calculateAdaptiveChunkSize({ ...baseParams, contextWindow: 128000 })
    expect(largeCtx).toBeGreaterThanOrEqual(smallCtx)
  })

  it('returns max for very large context windows', () => {
    const result = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 1048576,
    })
    // Default max is 100 when totalCues not provided
    expect(result).toBe(100)
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

  // New Phase 2 tests

  it('uses custom systemPromptOverhead', () => {
    const small = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 4096,
      systemPromptOverhead: 100,
    })
    const large = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 4096,
      systemPromptOverhead: 1000,
    })
    expect(small).toBeGreaterThan(large)
  })

  it('applies maxOutputTokens constraint', () => {
    // Very large context but small maxOutputTokens
    const result = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 1048576,
      maxOutputTokens: 100,
      avgCueTokens: 20,
    })
    // maxOutputTokens 100 / avgCueTokens 20 = 5
    expect(result).toBeLessThanOrEqual(5)
    expect(result).toBeGreaterThanOrEqual(4) // clamped to min
  })

  it('dynamic max is 200 for 100+ cue documents', () => {
    const result = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 1048576,
      totalCues: 150,
    })
    expect(result).toBe(200)
  })

  it('dynamic max is 300 for 500+ cue documents', () => {
    const result = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 1048576,
      totalCues: 600,
    })
    expect(result).toBe(300)
  })

  it('null maxOutputTokens does not constrain', () => {
    const withNull = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 128000,
      maxOutputTokens: null,
    })
    const without = calculateAdaptiveChunkSize({
      ...baseParams,
      contextWindow: 128000,
    })
    expect(withNull).toBe(without)
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

  it('uses language-aware estimation for CJK', () => {
    // Use longer text so the result exceeds the min(5) floor
    const cjkText = '这是一个比较长的中文字幕行，包含了更多的中文字符用于测试'
    const doc: SubtitleDocument = {
      format: 'srt',
      sourceFilename: 'test.srt',
      cues: [
        { sequence: 1, startMs: 0, endMs: 1000, rawText: cjkText, textLines: [cjkText], plainText: cjkText, inlineTags: [] },
      ],
      cueCount: 1,
    }
    const zhResult = estimateAvgCueTokens(doc, 'zh')
    const enResult = estimateAvgCueTokens(doc, 'en')
    // Chinese text should produce more tokens (fewer chars per token)
    expect(zhResult).toBeGreaterThan(enResult)
  })

  it('defaults to 4 chars/token without language', () => {
    const doc: SubtitleDocument = {
      format: 'srt',
      sourceFilename: 'test.srt',
      cues: [
        { sequence: 1, startMs: 0, endMs: 1000, rawText: '12345678', textLines: ['12345678'], plainText: '12345678', inlineTags: [] },
      ],
      cueCount: 1,
    }
    // 8 chars / 4 = 2, but min is 5
    expect(estimateAvgCueTokens(doc)).toBe(5)
    // Same without language
    expect(estimateAvgCueTokens(doc, undefined)).toBe(5)
  })
})

describe('calculateAdaptiveChunkBudget', () => {
  const baseParams = {
    contextWindow: null as number | null,
    avgCueTokens: 20,
    lookbehind: 3,
    lookahead: 3,
    contextUsageTarget: 0.6,
    outputStrategy: 'structured' as const,
  }

  it('returns a token budget, max cue count, and avg cue tokens', () => {
    const result = calculateAdaptiveChunkBudget({
      ...baseParams,
      contextWindow: 128_000,
    })
    expect(result).toHaveProperty('targetTokenBudget')
    expect(result).toHaveProperty('maxCueCount')
    expect(result).toHaveProperty('avgCueTokens')
    expect(result.targetTokenBudget).toBeGreaterThan(0)
    expect(result.maxCueCount).toBeGreaterThan(0)
    expect(result.avgCueTokens).toBe(20)
  })

  it('larger context windows produce larger token budgets', () => {
    const small = calculateAdaptiveChunkBudget({
      ...baseParams,
      contextWindow: 4_096,
    })
    const large = calculateAdaptiveChunkBudget({
      ...baseParams,
      contextWindow: 128_000,
    })
    expect(large.targetTokenBudget).toBeGreaterThan(small.targetTokenBudget)
  })

  it('maxOutputTokens constrains the budget', () => {
    const unconstrained = calculateAdaptiveChunkBudget({
      ...baseParams,
      contextWindow: 1_000_000,
    })
    const constrained = calculateAdaptiveChunkBudget({
      ...baseParams,
      contextWindow: 1_000_000,
      maxOutputTokens: 4_096,
      outputStabilityThreshold: 0.85,
    })
    // maxOutputTokens * 0.85 = 3481, which should limit the budget
    expect(constrained.targetTokenBudget).toBeLessThanOrEqual(4_096 * 0.85)
    expect(constrained.targetTokenBudget).toBeLessThan(unconstrained.targetTokenBudget)
  })

  it('safeInputBudget overrides contextWindow calculation', () => {
    const result = calculateAdaptiveChunkBudget({
      ...baseParams,
      contextWindow: 1_000_000, // huge, but overridden
      safeInputBudget: 10_000,
    })
    // Budget should be derived from 10K, not 1M
    // 10K - overhead (400+200+100+120) = 9180, × 0.5 = 4590
    expect(result.targetTokenBudget).toBeLessThan(10_000)
  })

  it('hardChunkCeiling limits maxCueCount', () => {
    const normal = calculateAdaptiveChunkBudget({
      ...baseParams,
      contextWindow: 128_000,
      totalCues: 600,
    })
    const ceilinged = calculateAdaptiveChunkBudget({
      ...baseParams,
      contextWindow: 128_000,
      totalCues: 600,
      hardChunkCeiling: 50,
    })
    expect(normal.maxCueCount).toBe(300) // 500+ → 300
    expect(ceilinged.maxCueCount).toBe(50)
  })

  it('ensures minimum token budget for very small contexts', () => {
    const result = calculateAdaptiveChunkBudget({
      ...baseParams,
      contextWindow: 100, // extremely small
    })
    // Should still have a viable budget (MIN_CHUNK_SIZE * avgCueTokens = 4 * 20 = 80)
    expect(result.targetTokenBudget).toBeGreaterThanOrEqual(80)
  })
})
