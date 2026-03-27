import { describe, it, expect } from 'vitest'
import { buildTranslateGemmaPrompt } from '../translate-gemma-prompt.js'

describe('buildTranslateGemmaPrompt', () => {
  it('produces exact output matching the Jinja template for en→hr', () => {
    const prompt = buildTranslateGemmaPrompt('en', 'hr', 'Hello')

    // Confirmed from actual template rendering:
    expect(prompt).toBe(
      '<bos><start_of_turn>user\n' +
      'You are a professional English (en) to Croatian (hr) translator. ' +
      'Your goal is to accurately convey the meaning and nuances of the original English text ' +
      'while adhering to Croatian grammar, vocabulary, and cultural sensitivities.\n' +
      'Produce only the Croatian translation, without any additional explanations or commentary. ' +
      'Please translate the following English text into Croatian:\n\n\n' +
      'Hello<end_of_turn>\n' +
      '<start_of_turn>model\n',
    )
  })

  it('normalises underscores to hyphens in language codes', () => {
    const prompt = buildTranslateGemmaPrompt('zh_hans', 'en', 'Test')
    expect(prompt).toContain('Chinese (Simplified) (zh-hans)')
  })

  it('trims whitespace from the source text', () => {
    const prompt = buildTranslateGemmaPrompt('en', 'de', '  Hallo  \n')
    expect(prompt).toContain('\n\n\nHallo<end_of_turn>')
  })

  it('falls back to the raw code when language is unknown', () => {
    const prompt = buildTranslateGemmaPrompt('en', 'xyz', 'Test')
    expect(prompt).toContain('xyz (xyz)')
  })

  it('ends with model generation prompt', () => {
    const prompt = buildTranslateGemmaPrompt('fr', 'es', 'Bonjour')
    expect(prompt.endsWith('<start_of_turn>model\n')).toBe(true)
  })

  it('starts with BOS token', () => {
    const prompt = buildTranslateGemmaPrompt('en', 'ja', 'Hello')
    expect(prompt.startsWith('<bos>')).toBe(true)
  })
})
