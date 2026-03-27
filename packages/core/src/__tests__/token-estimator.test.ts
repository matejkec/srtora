import { describe, it, expect } from 'vitest'
import { getCharsPerToken, estimateTokens } from '../chunking/token-estimator.js'

describe('getCharsPerToken', () => {
  it('returns 1.5 for CJK languages', () => {
    expect(getCharsPerToken('zh')).toBe(1.5)
    expect(getCharsPerToken('ja')).toBe(1.5)
  })

  it('returns 2 for Korean', () => {
    expect(getCharsPerToken('ko')).toBe(2)
  })

  it('returns 3.5 for Slavic languages', () => {
    expect(getCharsPerToken('hr')).toBe(3.5)
    expect(getCharsPerToken('sr')).toBe(3.5)
    expect(getCharsPerToken('pl')).toBe(3.5)
    expect(getCharsPerToken('ru')).toBe(3.5)
  })

  it('returns 4 for Latin/Germanic/Romance languages', () => {
    expect(getCharsPerToken('en')).toBe(4)
    expect(getCharsPerToken('de')).toBe(4)
    expect(getCharsPerToken('fr')).toBe(4)
    expect(getCharsPerToken('es')).toBe(4)
  })

  it('returns 3 for Arabic/Hebrew', () => {
    expect(getCharsPerToken('ar')).toBe(3)
    expect(getCharsPerToken('he')).toBe(3)
  })

  it('handles locale codes like en-US', () => {
    expect(getCharsPerToken('en-US')).toBe(4)
    expect(getCharsPerToken('zh-TW')).toBe(1.5)
  })

  it('returns default 4 for unknown languages', () => {
    expect(getCharsPerToken('xx')).toBe(4)
    expect(getCharsPerToken('unknown')).toBe(4)
  })

  it('is case-insensitive', () => {
    expect(getCharsPerToken('EN')).toBe(4)
    expect(getCharsPerToken('ZH')).toBe(1.5)
  })
})

describe('estimateTokens', () => {
  it('estimates English text tokens', () => {
    // "Hello world" = 11 chars / 4 = 2.75, ceil = 3
    expect(estimateTokens('Hello world', 'en')).toBe(3)
  })

  it('estimates CJK text tokens (more tokens per char)', () => {
    // "你好世界" = 4 chars / 1.5 = 2.67, ceil = 3
    expect(estimateTokens('你好世界', 'zh')).toBe(3)
  })

  it('returns at least 1 for empty string', () => {
    expect(estimateTokens('', 'en')).toBe(1)
  })

  it('estimates longer text proportionally', () => {
    const short = estimateTokens('Hi', 'en')
    const long = estimateTokens('This is a much longer sentence with many more tokens', 'en')
    expect(long).toBeGreaterThan(short)
  })
})
