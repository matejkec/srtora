import { describe, it, expect } from 'vitest'
import { mergeMemoryIntoSession, extractMemoryUpdates, getRelevantCorrections } from '../memory-injector.js'
import type { SessionMemory, TranslationMemory, TranslationResult, StoredTerm, CorrectionEntry } from '@srtora/types'

const now = new Date().toISOString()

const makeTerm = (source: string, target: string, pair = 'en->hr'): StoredTerm => ({
  source,
  target,
  confidence: 1,
  createdAt: now,
  updatedAt: now,
  languagePair: pair,
})

const makeCorrection = (src: string, orig: string, corrected: string, pair = 'en->hr'): CorrectionEntry => ({
  sourceText: src,
  originalTranslation: orig,
  correctedTranslation: corrected,
  languagePair: pair,
  createdAt: now,
})

describe('mergeMemoryIntoSession', () => {
  it('returns empty session memory when both inputs are empty', () => {
    const memory: TranslationMemory = { version: 1, terms: [], speakers: [], corrections: [] }
    const result = mergeMemoryIntoSession(memory, undefined, 'en->hr')
    expect(result.terms).toHaveLength(0)
    expect(result.speakers).toHaveLength(0)
  })

  it('adds stored terms when session has none', () => {
    const memory: TranslationMemory = {
      version: 1,
      terms: [makeTerm('hello', 'bok')],
      speakers: [],
      corrections: [],
    }
    const result = mergeMemoryIntoSession(memory, undefined, 'en->hr')
    expect(result.terms).toHaveLength(1)
    expect(result.terms[0]!.source).toBe('hello')
  })

  it('filters terms by language pair', () => {
    const memory: TranslationMemory = {
      version: 1,
      terms: [
        makeTerm('hello', 'bok', 'en->hr'),
        makeTerm('hello', 'hola', 'en->es'),
      ],
      speakers: [],
      corrections: [],
    }
    const result = mergeMemoryIntoSession(memory, undefined, 'en->hr')
    expect(result.terms).toHaveLength(1)
    expect(result.terms[0]!.target).toBe('bok')
  })

  it('session terms take priority over stored terms', () => {
    const memory: TranslationMemory = {
      version: 1,
      terms: [makeTerm('hello', 'stored-bok')],
      speakers: [],
      corrections: [],
    }
    const session: SessionMemory = {
      speakers: [],
      terms: [{ source: 'Hello', target: 'session-bok' }],
      warnings: [],
    }
    const result = mergeMemoryIntoSession(memory, session, 'en->hr')
    expect(result.terms).toHaveLength(1)
    expect(result.terms[0]!.target).toBe('session-bok')
  })

  it('merges speakers without duplicates', () => {
    const memory: TranslationMemory = {
      version: 1,
      terms: [],
      speakers: [
        {
          id: 'sp1',
          label: 'John',
          aliases: [],
          gender: 'male',
          genderConfidence: 0.9,
          sourceFiles: ['file1.srt'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      corrections: [],
    }
    const session: SessionMemory = {
      speakers: [
        { id: 'sp1', label: 'John', aliases: [], gender: 'male', genderConfidence: 0.8 },
      ],
      terms: [],
      warnings: [],
    }
    const result = mergeMemoryIntoSession(memory, session, 'en->hr')
    // Session's John takes priority, stored John is skipped
    expect(result.speakers).toHaveLength(1)
    expect(result.speakers[0]!.genderConfidence).toBe(0.8) // session value
  })
})

describe('getRelevantCorrections', () => {
  it('filters by language pair', () => {
    const memory: TranslationMemory = {
      version: 1,
      terms: [],
      speakers: [],
      corrections: [
        makeCorrection('test', 'bad', 'good', 'en->hr'),
        makeCorrection('test', 'malo', 'bueno', 'en->es'),
      ],
    }
    const result = getRelevantCorrections(memory, 'en->hr')
    expect(result).toHaveLength(1)
    expect(result[0]!.correctedTranslation).toBe('good')
  })

  it('limits results', () => {
    const corrections = Array.from({ length: 30 }, (_, i) =>
      makeCorrection(`src${i}`, `old${i}`, `new${i}`),
    )
    const memory: TranslationMemory = { version: 1, terms: [], speakers: [], corrections }
    const result = getRelevantCorrections(memory, 'en->hr', 10)
    expect(result).toHaveLength(10)
  })
})

describe('extractMemoryUpdates', () => {
  it('extracts terms and speakers from result', () => {
    const result: TranslationResult = {
      document: { format: 'srt', sourceFilename: 'test.srt', cues: [], cueCount: 0 },
      sessionMemory: {
        speakers: [{ id: 'sp1', label: 'Alice', aliases: [], gender: 'female', genderConfidence: 0.9 }],
        terms: [{ source: 'hello', target: 'bok' }],
        warnings: [],
      },
      chunks: [],
      warnings: [],
      outputContent: '',
      stats: { totalChunks: 0, totalRetries: 0, totalDurationMs: 0, phaseDurations: {} },
    }

    const updates = extractMemoryUpdates(result, 'en->hr', 'test.srt')
    expect(updates.terms).toHaveLength(1)
    expect(updates.terms[0]!.languagePair).toBe('en->hr')
    expect(updates.speakers).toHaveLength(1)
    expect(updates.speakers[0]!.sourceFiles).toContain('test.srt')
  })

  it('returns empty arrays when no session memory', () => {
    const result: TranslationResult = {
      document: { format: 'srt', sourceFilename: 'test.srt', cues: [], cueCount: 0 },
      chunks: [],
      warnings: [],
      outputContent: '',
      stats: { totalChunks: 0, totalRetries: 0, totalDurationMs: 0, phaseDurations: {} },
    }

    const updates = extractMemoryUpdates(result, 'en->hr', 'test.srt')
    expect(updates.terms).toHaveLength(0)
    expect(updates.speakers).toHaveLength(0)
  })
})
