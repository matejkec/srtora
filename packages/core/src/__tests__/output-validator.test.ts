import { describe, it, expect } from 'vitest'
import { validateOutput } from '../validation/output-validator.js'
import type { SubtitleDocument } from '@srtora/types'

function makeDoc(cueCount: number): SubtitleDocument {
  return {
    format: 'srt',
    sourceFilename: 'test.srt',
    cueCount,
    cues: Array.from({ length: cueCount }, (_, i) => ({
      sequence: i + 1,
      startMs: i * 3000,
      endMs: i * 3000 + 2500,
      rawText: `Line ${i + 1}`,
      textLines: [`Line ${i + 1}`],
      plainText: `Line ${i + 1}`,
      inlineTags: [],
    })),
    vttMetadata: null,
  }
}

describe('validateOutput', () => {
  it('passes for valid complete translations', () => {
    const doc = makeDoc(3)
    const translations = new Map([
      [1, 'Linija 1'],
      [2, 'Linija 2'],
      [3, 'Linija 3'],
    ])

    const result = validateOutput(doc, translations)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('flags missing translations', () => {
    const doc = makeDoc(3)
    const translations = new Map([
      [1, 'Linija 1'],
      // Missing cue 2
      [3, 'Linija 3'],
    ])

    const result = validateOutput(doc, translations)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.includes('Missing translation for cue 2'))).toBe(true)
  })

  it('flags empty translations for non-empty sources', () => {
    const doc = makeDoc(2)
    const translations = new Map([
      [1, 'Linija 1'],
      [2, '  '],
    ])

    const result = validateOutput(doc, translations)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.includes('Empty translation'))).toBe(true)
  })

  it('flags extra translations for non-existent cues', () => {
    const doc = makeDoc(2)
    const translations = new Map([
      [1, 'Linija 1'],
      [2, 'Linija 2'],
      [99, 'Extra'],
    ])

    const result = validateOutput(doc, translations)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.includes('non-existent cue 99'))).toBe(true)
  })

  it('flags count mismatch', () => {
    const doc = makeDoc(3)
    const translations = new Map([
      [1, 'Linija 1'],
      [2, 'Linija 2'],
    ])

    const result = validateOutput(doc, translations)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.includes("doesn't match"))).toBe(true)
  })
})
