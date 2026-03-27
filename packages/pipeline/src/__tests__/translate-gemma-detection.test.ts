import { describe, it, expect } from 'vitest'
import { isTranslateGemmaModel } from '../orchestrator.js'

describe('isTranslateGemmaModel', () => {
  it('matches canonical hyphenated model names', () => {
    expect(isTranslateGemmaModel('translate-gemma-2b')).toBe(true)
    expect(isTranslateGemmaModel('google/translate-gemma-2b')).toBe(true)
  })

  it('matches PascalCase / no-separator names', () => {
    expect(isTranslateGemmaModel('TranslateGemma')).toBe(true)
    expect(isTranslateGemmaModel('TranslateGemma-2.9B-4bit')).toBe(true)
    expect(isTranslateGemmaModel('translategemma')).toBe(true)
  })

  it('matches mlx-community prefixed paths', () => {
    expect(isTranslateGemmaModel('mlx-community/TranslateGemma-2.9b-4bit-mlx')).toBe(true)
    expect(isTranslateGemmaModel('mlx-community/translate-gemma-2b-4bit')).toBe(true)
  })

  it('matches underscore variants', () => {
    expect(isTranslateGemmaModel('translate_gemma')).toBe(true)
    expect(isTranslateGemmaModel('translate_gemma_2b_mlx')).toBe(true)
  })

  it('matches reversed order (gemma-translate)', () => {
    expect(isTranslateGemmaModel('gemma-translate')).toBe(true)
    expect(isTranslateGemmaModel('gemma_translate_v2')).toBe(true)
  })

  it('does NOT match standard Gemma chat models', () => {
    expect(isTranslateGemmaModel('gemma-3-12b-it')).toBe(false)
    expect(isTranslateGemmaModel('gemma-2-2b-it')).toBe(false)
    expect(isTranslateGemmaModel('gemma-3-12b-it-4bit')).toBe(false)
  })

  it('does NOT match unrelated models', () => {
    expect(isTranslateGemmaModel('gpt-4o')).toBe(false)
    expect(isTranslateGemmaModel('llama-3-8b-instruct')).toBe(false)
    expect(isTranslateGemmaModel('mistral-7b-v0.1')).toBe(false)
  })
})
