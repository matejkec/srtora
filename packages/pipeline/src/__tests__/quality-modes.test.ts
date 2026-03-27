import { describe, it, expect } from 'vitest'
import { QUALITY_MODES, getQualityMode, listQualityModes } from '../quality-modes.js'

describe('QUALITY_MODES', () => {
  it('has all four quality modes defined', () => {
    expect(Object.keys(QUALITY_MODES)).toHaveLength(4)
    expect(QUALITY_MODES.fast).toBeDefined()
    expect(QUALITY_MODES.balanced).toBeDefined()
    expect(QUALITY_MODES['high-quality']).toBeDefined()
    expect(QUALITY_MODES.maximum).toBeDefined()
  })

  it('fast mode disables analysis and review', () => {
    expect(QUALITY_MODES.fast.enableAnalysis).toBe(false)
    expect(QUALITY_MODES.fast.enableReview).toBe(false)
    expect(QUALITY_MODES.fast.reviewPasses).toBe(0)
  })

  it('balanced mode enables analysis and review with 1 pass', () => {
    expect(QUALITY_MODES.balanced.enableAnalysis).toBe(true)
    expect(QUALITY_MODES.balanced.enableReview).toBe(true)
    expect(QUALITY_MODES.balanced.reviewPasses).toBe(1)
  })

  it('high-quality mode has multi-pass review', () => {
    expect(QUALITY_MODES['high-quality'].reviewPasses).toBe(2)
    expect(QUALITY_MODES['high-quality'].enforceTerminology).toBe(true)
  })

  it('maximum mode has the most review passes', () => {
    expect(QUALITY_MODES.maximum.reviewPasses).toBe(3)
    expect(QUALITY_MODES.maximum.enforceTerminology).toBe(true)
    expect(QUALITY_MODES.maximum.validateSpeakerConsistency).toBe(true)
  })

  it('context usage target decreases with higher quality', () => {
    expect(QUALITY_MODES.fast.contextUsageTarget).toBeGreaterThan(QUALITY_MODES.balanced.contextUsageTarget)
    expect(QUALITY_MODES.balanced.contextUsageTarget).toBeGreaterThan(QUALITY_MODES['high-quality'].contextUsageTarget)
    expect(QUALITY_MODES['high-quality'].contextUsageTarget).toBeGreaterThan(QUALITY_MODES.maximum.contextUsageTarget)
  })

  it('all modes use adaptive chunk sizing', () => {
    for (const mode of Object.values(QUALITY_MODES)) {
      expect(mode.chunkSizingStrategy).toBe('adaptive')
    }
  })
})

describe('getQualityMode', () => {
  it('returns the correct mode for each ID', () => {
    expect(getQualityMode('fast').id).toBe('fast')
    expect(getQualityMode('balanced').id).toBe('balanced')
    expect(getQualityMode('high-quality').id).toBe('high-quality')
    expect(getQualityMode('maximum').id).toBe('maximum')
  })
})

describe('listQualityModes', () => {
  it('returns all modes in order from fastest to highest quality', () => {
    const modes = listQualityModes()
    expect(modes).toHaveLength(4)
    expect(modes[0]!.id).toBe('fast')
    expect(modes[1]!.id).toBe('balanced')
    expect(modes[2]!.id).toBe('high-quality')
    expect(modes[3]!.id).toBe('maximum')
  })
})
