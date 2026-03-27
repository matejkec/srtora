import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseSrt } from '../parser/srt-parser.js'
import { assembleSrt } from '../assembler/srt-assembler.js'

const FIXTURES = join(import.meta.dirname, 'fixtures')

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

describe('SRT Parser', () => {
  describe('basic parsing', () => {
    it('parses a basic SRT file correctly', () => {
      const content = readFixture('basic.srt')
      const doc = parseSrt(content, 'basic.srt')

      expect(doc.format).toBe('srt')
      expect(doc.sourceFilename).toBe('basic.srt')
      expect(doc.cueCount).toBe(5)
      expect(doc.cues).toHaveLength(5)
      expect(doc.vttMetadata).toBeNull()
    })

    it('extracts correct sequence numbers', () => {
      const content = readFixture('basic.srt')
      const doc = parseSrt(content, 'basic.srt')

      expect(doc.cues[0]!.sequence).toBe(1)
      expect(doc.cues[4]!.sequence).toBe(5)
    })

    it('parses timestamps correctly', () => {
      const content = readFixture('basic.srt')
      const doc = parseSrt(content, 'basic.srt')

      expect(doc.cues[0]!.startMs).toBe(1000)
      expect(doc.cues[0]!.endMs).toBe(4000)
      expect(doc.cues[2]!.startMs).toBe(9500)
      expect(doc.cues[2]!.endMs).toBe(12000)
    })

    it('extracts text lines correctly', () => {
      const content = readFixture('basic.srt')
      const doc = parseSrt(content, 'basic.srt')

      expect(doc.cues[0]!.rawText).toBe('Hello, world.')
      expect(doc.cues[0]!.textLines).toEqual(['Hello, world.'])
      expect(doc.cues[0]!.plainText).toBe('Hello, world.')
    })
  })

  describe('multi-line cues', () => {
    it('handles multi-line text', () => {
      const content = '1\n00:00:01,000 --> 00:00:04,000\nLine one\nLine two\n\n'
      const doc = parseSrt(content, 'test.srt')

      expect(doc.cues[0]!.textLines).toEqual(['Line one', 'Line two'])
      expect(doc.cues[0]!.rawText).toBe('Line one\nLine two')
    })
  })

  describe('formatting tags', () => {
    it('extracts inline tags from formatted text', () => {
      const content = readFixture('formatting-tags.srt')
      const doc = parseSrt(content, 'formatting-tags.srt')

      expect(doc.cues[0]!.inlineTags).toContain('<i>')
      expect(doc.cues[0]!.inlineTags).toContain('</i>')
      expect(doc.cues[0]!.plainText).toBe('This is italic text.')
    })

    it('handles nested tags', () => {
      const content = readFixture('formatting-tags.srt')
      const doc = parseSrt(content, 'formatting-tags.srt')

      const lastCue = doc.cues[4]!
      expect(lastCue.inlineTags).toContain('<b>')
      expect(lastCue.inlineTags).toContain('<i>')
      expect(lastCue.plainText).toBe('Bold and italic.')
    })

    it('handles font color tags', () => {
      const content = readFixture('formatting-tags.srt')
      const doc = parseSrt(content, 'formatting-tags.srt')

      const cue = doc.cues[3]!
      expect(cue.inlineTags).toContain('<font color="#ff0000">')
      expect(cue.plainText).toBe('Red text here.')
    })
  })

  describe('edge cases', () => {
    it('handles BOM character', () => {
      const content = '\uFEFF1\n00:00:01,000 --> 00:00:04,000\nHello\n\n'
      const doc = parseSrt(content, 'bom.srt')

      expect(doc.cueCount).toBe(1)
      expect(doc.cues[0]!.rawText).toBe('Hello')
    })

    it('handles Windows line endings (\\r\\n)', () => {
      const content = '1\r\n00:00:01,000 --> 00:00:04,000\r\nHello\r\n\r\n'
      const doc = parseSrt(content, 'crlf.srt')

      expect(doc.cueCount).toBe(1)
      expect(doc.cues[0]!.rawText).toBe('Hello')
    })

    it('handles missing final blank line', () => {
      const content = '1\n00:00:01,000 --> 00:00:04,000\nHello'
      const doc = parseSrt(content, 'no-final-newline.srt')

      expect(doc.cueCount).toBe(1)
      expect(doc.cues[0]!.rawText).toBe('Hello')
    })

    it('handles extra blank lines between cues', () => {
      const content =
        '1\n00:00:01,000 --> 00:00:04,000\nFirst\n\n\n\n2\n00:00:05,000 --> 00:00:08,000\nSecond\n\n'
      const doc = parseSrt(content, 'extra-blanks.srt')

      expect(doc.cueCount).toBe(2)
      expect(doc.cues[0]!.rawText).toBe('First')
      expect(doc.cues[1]!.rawText).toBe('Second')
    })

    it('handles empty cue text', () => {
      const content = '1\n00:00:01,000 --> 00:00:04,000\n\n\n2\n00:00:05,000 --> 00:00:08,000\nText\n\n'
      const doc = parseSrt(content, 'empty-cue.srt')

      // Empty cue gets no text lines, so finalizeCue produces rawText = ""
      expect(doc.cueCount).toBe(2)
    })

    it('handles period as millisecond separator (non-standard)', () => {
      const content = '1\n00:00:01.000 --> 00:00:04.000\nHello\n\n'
      const doc = parseSrt(content, 'period-separator.srt')

      expect(doc.cueCount).toBe(1)
      expect(doc.cues[0]!.startMs).toBe(1000)
    })

    it('handles large hour values', () => {
      const content = '1\n01:30:00,000 --> 01:30:05,000\nLong movie\n\n'
      const doc = parseSrt(content, 'large-hours.srt')

      expect(doc.cues[0]!.startMs).toBe(5400000) // 1h 30m in ms
    })
  })
})

describe('SRT Assembler', () => {
  it('assembles a basic document correctly', () => {
    const content = readFixture('basic.srt')
    const doc = parseSrt(content, 'basic.srt')
    const output = assembleSrt(doc)

    // Parse the output back and verify structure matches
    const reparsed = parseSrt(output, 'basic.srt')
    expect(reparsed.cueCount).toBe(doc.cueCount)
    for (let i = 0; i < doc.cues.length; i++) {
      expect(reparsed.cues[i]!.sequence).toBe(doc.cues[i]!.sequence)
      expect(reparsed.cues[i]!.startMs).toBe(doc.cues[i]!.startMs)
      expect(reparsed.cues[i]!.endMs).toBe(doc.cues[i]!.endMs)
      expect(reparsed.cues[i]!.rawText).toBe(doc.cues[i]!.rawText)
    }
  })

  it('assembles with translations', () => {
    const content = readFixture('basic.srt')
    const doc = parseSrt(content, 'basic.srt')

    const translations = new Map<number, string>()
    translations.set(1, 'Halo, svijete.')
    translations.set(2, 'Kako si?')

    const output = assembleSrt(doc, translations)
    const reparsed = parseSrt(output, 'translated.srt')

    expect(reparsed.cues[0]!.rawText).toBe('Halo, svijete.')
    expect(reparsed.cues[1]!.rawText).toBe('Kako si?')
    // Untranslated cues keep original text
    expect(reparsed.cues[2]!.rawText).toBe("I'm doing well, thanks.")
  })

  it('round-trips basic SRT correctly', () => {
    const content = readFixture('basic.srt')
    const doc = parseSrt(content, 'basic.srt')
    const output = assembleSrt(doc)

    // Reparse and reassemble should be stable
    const doc2 = parseSrt(output, 'basic.srt')
    const output2 = assembleSrt(doc2)
    expect(output2).toBe(output)
  })

  it('round-trips formatting tags SRT correctly', () => {
    const content = readFixture('formatting-tags.srt')
    const doc = parseSrt(content, 'formatting-tags.srt')
    const output = assembleSrt(doc)

    const doc2 = parseSrt(output, 'formatting-tags.srt')
    const output2 = assembleSrt(doc2)
    expect(output2).toBe(output)
  })
})
