import { describe, it, expect } from 'vitest'
import { buildTranslationPrompt, translationOutputSchema } from '../builders/translation-prompt.js'
import type { SubtitleCue, SessionMemory } from '@srtora/types'

function makeCue(seq: number, text: string): SubtitleCue {
  return {
    sequence: seq,
    startMs: seq * 3000,
    endMs: seq * 3000 + 2500,
    rawText: text,
    textLines: [text],
    plainText: text,
    inlineTags: [],
  }
}

describe('buildTranslationPrompt', () => {
  it('includes target cues in TRANSLATE section', () => {
    const { user } = buildTranslationPrompt({
      targetCues: [makeCue(1, 'Hello'), makeCue(2, 'World')],
      contextBefore: [],
      contextAfter: [],
      sourceLanguage: 'en',
      targetLanguage: 'hr',
    })

    expect(user).toContain('--- TRANSLATE ---')
    expect(user).toContain('[1] Hello')
    expect(user).toContain('[2] World')
  })

  it('includes context before with previous translations', () => {
    const prev = new Map([[1, 'Bok']])
    const { user } = buildTranslationPrompt({
      targetCues: [makeCue(2, 'World')],
      contextBefore: [makeCue(1, 'Hello')],
      contextAfter: [],
      previousTranslations: prev,
      sourceLanguage: 'en',
      targetLanguage: 'hr',
    })

    expect(user).toContain('CONTEXT (already translated)')
    expect(user).toContain('[1] Hello → Bok')
  })

  it('includes context after', () => {
    const { user } = buildTranslationPrompt({
      targetCues: [makeCue(1, 'Hello')],
      contextBefore: [],
      contextAfter: [makeCue(2, 'World')],
      sourceLanguage: 'en',
      targetLanguage: 'hr',
    })

    expect(user).toContain('CONTEXT (upcoming)')
    expect(user).toContain('[2] World')
  })

  it('includes session memory speakers and terms', () => {
    const memory: SessionMemory = {
      speakers: [
        { id: 'sp1', label: 'Ana', gender: 'female', genderConfidence: 0.9, register: 'informal' },
      ],
      terms: [
        { source: 'Captain', target: 'Kapetanica' },
      ],
      warnings: [],
    }

    const { system } = buildTranslationPrompt({
      targetCues: [makeCue(1, 'Hello')],
      contextBefore: [],
      contextAfter: [],
      sessionMemory: memory,
      sourceLanguage: 'en',
      targetLanguage: 'hr',
    })

    expect(system).toContain('Ana')
    expect(system).toContain('female')
    expect(system).toContain('Captain')
    expect(system).toContain('Kapetanica')
  })

  it('system prompt requests JSON output', () => {
    const { system } = buildTranslationPrompt({
      targetCues: [makeCue(1, 'Hello')],
      contextBefore: [],
      contextAfter: [],
      sourceLanguage: 'en',
      targetLanguage: 'hr',
    })

    expect(system).toContain('JSON')
  })
})

describe('translationOutputSchema', () => {
  it('has the correct shape', () => {
    expect(translationOutputSchema.type).toBe('object')
    expect(translationOutputSchema.properties.translations.type).toBe('array')
    expect(translationOutputSchema.required).toContain('translations')
  })
})
