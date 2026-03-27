import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseVtt } from '../parser/vtt-parser.js'
import { assembleVtt } from '../assembler/vtt-assembler.js'

const FIXTURES = join(import.meta.dirname, 'fixtures')

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

describe('VTT Parser', () => {
  describe('basic parsing', () => {
    it('parses a basic VTT file correctly', () => {
      const content = readFixture('basic.vtt')
      const doc = parseVtt(content, 'basic.vtt')

      expect(doc.format).toBe('vtt')
      expect(doc.sourceFilename).toBe('basic.vtt')
      expect(doc.cueCount).toBe(5)
      expect(doc.cues).toHaveLength(5)
      expect(doc.vttMetadata).not.toBeNull()
    })

    it('parses MM:SS.mmm timestamps (no hours)', () => {
      const content = readFixture('basic.vtt')
      const doc = parseVtt(content, 'basic.vtt')

      expect(doc.cues[0]!.startMs).toBe(1000)
      expect(doc.cues[0]!.endMs).toBe(4000)
      expect(doc.cues[2]!.startMs).toBe(9500)
    })

    it('parses HH:MM:SS.mmm timestamps', () => {
      const content = 'WEBVTT\n\n01:00:05.000 --> 01:00:10.000\nLong video\n\n'
      const doc = parseVtt(content, 'hours.vtt')

      expect(doc.cues[0]!.startMs).toBe(3605000)
    })

    it('extracts text correctly', () => {
      const content = readFixture('basic.vtt')
      const doc = parseVtt(content, 'basic.vtt')

      expect(doc.cues[0]!.rawText).toBe('Hello, world.')
      expect(doc.cues[0]!.plainText).toBe('Hello, world.')
    })
  })

  describe('VTT-specific features', () => {
    it('preserves STYLE blocks', () => {
      const content = readFixture('edge-cases.vtt')
      const doc = parseVtt(content, 'edge-cases.vtt')

      expect(doc.vttMetadata!.styleBlocks).toHaveLength(1)
      expect(doc.vttMetadata!.styleBlocks[0]).toContain('::cue')
    })

    it('preserves REGION blocks', () => {
      const content = readFixture('edge-cases.vtt')
      const doc = parseVtt(content, 'edge-cases.vtt')

      expect(doc.vttMetadata!.regionBlocks).toHaveLength(1)
      expect(doc.vttMetadata!.regionBlocks[0]).toContain('id:narrator')
    })

    it('preserves NOTE blocks', () => {
      const content = readFixture('edge-cases.vtt')
      const doc = parseVtt(content, 'edge-cases.vtt')

      const notes = doc.vttMetadata!.noteBlocks
      expect(notes.length).toBeGreaterThanOrEqual(1)
    })

    it('preserves cue identifiers', () => {
      const content = readFixture('edge-cases.vtt')
      const doc = parseVtt(content, 'edge-cases.vtt')

      const identifiers = doc.vttMetadata!.cueIdentifiers
      expect(identifiers['1']).toBe('intro-1')
      expect(identifiers['2']).toBe('intro-2')
    })

    it('preserves cue settings', () => {
      const content = readFixture('edge-cases.vtt')
      const doc = parseVtt(content, 'edge-cases.vtt')

      const settings = doc.vttMetadata!.cueSettings
      expect(settings['2']).toContain('position:50%')
      expect(settings['4']).toContain('region:narrator')
    })

    it('handles VTT-specific tags (v, c)', () => {
      const content = readFixture('edge-cases.vtt')
      const doc = parseVtt(content, 'edge-cases.vtt')

      // <v Speaker1> tag
      const cue3 = doc.cues[2]!
      expect(cue3.inlineTags).toContain('<v Speaker1>')
    })
  })

  describe('formatting tags', () => {
    it('parses formatting tags correctly', () => {
      const content = readFixture('formatting-tags.vtt')
      const doc = parseVtt(content, 'formatting-tags.vtt')

      expect(doc.cues[0]!.inlineTags).toContain('<i>')
      expect(doc.cues[0]!.plainText).toBe('This is italic text.')
    })
  })

  describe('edge cases', () => {
    it('rejects files without WEBVTT header', () => {
      expect(() => parseVtt('Not a VTT file\n\n', 'bad.vtt')).toThrow('WEBVTT header')
    })

    it('handles header text after WEBVTT', () => {
      const content = 'WEBVTT - My subtitle file\n\n00:01.000 --> 00:04.000\nHello\n\n'
      const doc = parseVtt(content, 'header-text.vtt')

      expect(doc.vttMetadata!.headerText).toBe('- My subtitle file')
      expect(doc.cueCount).toBe(1)
    })

    it('handles BOM character', () => {
      const content = '\uFEFFWEBVTT\n\n00:01.000 --> 00:04.000\nHello\n\n'
      const doc = parseVtt(content, 'bom.vtt')

      expect(doc.cueCount).toBe(1)
    })
  })
})

describe('VTT Assembler', () => {
  it('assembles a basic VTT document', () => {
    const content = readFixture('basic.vtt')
    const doc = parseVtt(content, 'basic.vtt')
    const output = assembleVtt(doc)

    expect(output).toContain('WEBVTT')
    const reparsed = parseVtt(output, 'basic.vtt')
    expect(reparsed.cueCount).toBe(doc.cueCount)
  })

  it('preserves STYLE and REGION blocks on reassembly', () => {
    const content = readFixture('edge-cases.vtt')
    const doc = parseVtt(content, 'edge-cases.vtt')
    const output = assembleVtt(doc)

    expect(output).toContain('STYLE')
    expect(output).toContain('REGION')
    expect(output).toContain('::cue')
    expect(output).toContain('id:narrator')
  })

  it('preserves cue identifiers on reassembly', () => {
    const content = readFixture('edge-cases.vtt')
    const doc = parseVtt(content, 'edge-cases.vtt')
    const output = assembleVtt(doc)

    expect(output).toContain('intro-1')
    expect(output).toContain('intro-2')
  })

  it('round-trips basic VTT correctly', () => {
    const content = readFixture('basic.vtt')
    const doc = parseVtt(content, 'basic.vtt')
    const output = assembleVtt(doc)

    const doc2 = parseVtt(output, 'basic.vtt')
    const output2 = assembleVtt(doc2)
    expect(output2).toBe(output)
  })

  it('round-trips formatting tags VTT correctly', () => {
    const content = readFixture('formatting-tags.vtt')
    const doc = parseVtt(content, 'formatting-tags.vtt')
    const output = assembleVtt(doc)

    const doc2 = parseVtt(output, 'formatting-tags.vtt')
    const output2 = assembleVtt(doc2)
    expect(output2).toBe(output)
  })
})
