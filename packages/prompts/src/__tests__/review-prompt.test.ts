import { describe, it, expect } from 'vitest'
import { buildReviewPrompt, flagTranslations } from '../builders/review-prompt.js'
import type { SubtitleCue, SessionMemory } from '@srtora/types'

function makeCue(seq: number, text: string, tags: string[] = []): SubtitleCue {
  return {
    sequence: seq,
    startMs: seq * 3000,
    endMs: seq * 3000 + 2500,
    rawText: text,
    textLines: [text],
    plainText: text.replace(/<[^>]+>/g, ''),
    inlineTags: tags,
  }
}

describe('flagTranslations', () => {
  it('flags empty translations for non-empty source', () => {
    const cues = [makeCue(1, 'Hello')]
    const translations = new Map([[1, '   ']])

    const flags = flagTranslations({ cues, translations })
    expect(flags).toHaveLength(1)
    expect(flags[0]!.reason).toBe('empty_translation')
  })

  it('flags missing formatting tags', () => {
    const cues = [makeCue(1, '<b>Hello</b>', ['<b>', '</b>'])]
    const translations = new Map([[1, 'Bok']])

    const flags = flagTranslations({ cues, translations })
    expect(flags).toHaveLength(1)
    expect(flags[0]!.reason).toBe('missing_tag')
  })

  it('flags significant length differences', () => {
    const cues = [makeCue(1, 'This is a medium length sentence for testing.')]
    const translations = new Map([
      [1, 'A'.repeat(200)],
    ])

    const flags = flagTranslations({ cues, translations })
    const lengthFlag = flags.find((f) => f.reason === 'length_issue')
    expect(lengthFlag).toBeDefined()
  })

  it('flags term inconsistency', () => {
    const cues = [makeCue(1, 'The Captain ordered the crew.')]
    const translations = new Map([[1, 'Nešto je naredio posadi.']])
    const memory: SessionMemory = {
      speakers: [],
      terms: [{ source: 'Captain', target: 'Kapetanica' }],
      warnings: [],
    }

    const flags = flagTranslations({ cues, translations, sessionMemory: memory })
    const termFlag = flags.find((f) => f.reason === 'term_inconsistency')
    expect(termFlag).toBeDefined()
  })

  it('does not flag correct translations', () => {
    const cues = [makeCue(1, 'Hello')]
    const translations = new Map([[1, 'Bok']])

    const flags = flagTranslations({ cues, translations })
    expect(flags).toHaveLength(0)
  })
})

describe('buildReviewPrompt', () => {
  it('includes all flags in the prompt', () => {
    const flags = [
      {
        cueSequence: 1,
        reason: 'empty_translation' as const,
        details: 'Translation is empty',
        sourceText: 'Hello',
        currentTranslation: '',
      },
    ]
    const cues = [makeCue(1, 'Hello')]
    const translations = new Map([[1, '']])

    const { system, user } = buildReviewPrompt({
      flags,
      allCues: cues,
      translations,
      sourceLanguage: 'en',
      targetLanguage: 'hr',
    })

    expect(system).toContain('JSON')
    expect(user).toContain('empty_translation')
    expect(user).toContain('[1]')
  })
})
