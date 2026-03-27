import { describe, it, expect } from 'vitest'
import { assembleBilingual } from '../assembler/bilingual.js'
import { parseSrt } from '../parser/srt-parser.js'
import { readFileSync } from 'fs'
import { join } from 'path'

const FIXTURES = join(import.meta.dirname, 'fixtures')

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

describe('assembleBilingual', () => {
  it('includes both source and target text in each cue', () => {
    const doc = parseSrt(readFixture('basic.srt'), 'basic.srt')
    const translations = new Map<number, string>()
    for (const cue of doc.cues) {
      translations.set(cue.sequence, `Translated: ${cue.plainText}`)
    }

    const output = assembleBilingual(doc, translations)

    // Each cue should have the original text followed by translated text
    for (const cue of doc.cues) {
      expect(output).toContain(cue.rawText)
      expect(output).toContain(`Translated: ${cue.plainText}`)
    }
  })

  it('uses source text if translation is missing', () => {
    const doc = parseSrt(readFixture('basic.srt'), 'basic.srt')
    // Only translate first cue
    const translations = new Map<number, string>([
      [1, 'Translated first'],
    ])

    const output = assembleBilingual(doc, translations)
    expect(output).toContain('Translated first')
    // Other cues should still appear with source text
    expect(output).toContain(doc.cues[1]!.rawText)
  })

  it('preserves timestamp format', () => {
    const doc = parseSrt(readFixture('basic.srt'), 'basic.srt')
    const translations = new Map<number, string>([
      [1, 'Test'],
    ])

    const output = assembleBilingual(doc, translations)
    expect(output).toContain('-->')
  })
})
