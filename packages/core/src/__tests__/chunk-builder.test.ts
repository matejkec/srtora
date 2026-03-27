import { describe, it, expect } from 'vitest'
import { buildChunks } from '../chunking/chunk-builder.js'
import { mergeChunkResults } from '../chunking/chunk-merger.js'
import { parseSrt } from '../parser/srt-parser.js'
import type { ChunkTranslationResult } from '@srtora/types'

function makeDoc(cueCount: number) {
  const lines: string[] = []
  for (let i = 1; i <= cueCount; i++) {
    const start = (i - 1) * 3
    const end = start + 2
    lines.push(`${i}`)
    lines.push(
      `00:00:${String(start).padStart(2, '0')},000 --> 00:00:${String(end).padStart(2, '0')},000`,
    )
    lines.push(`Subtitle ${i}`)
    lines.push('')
  }
  return parseSrt(lines.join('\n'), 'test.srt')
}

describe('Chunk Builder', () => {
  it('creates correct number of chunks', () => {
    const doc = makeDoc(10)
    const chunks = buildChunks(doc, { chunkSize: 3, lookbehind: 1, lookahead: 1 })

    expect(chunks).toHaveLength(4) // 3+3+3+1
  })

  it('first chunk has no lookbehind', () => {
    const doc = makeDoc(10)
    const chunks = buildChunks(doc, { chunkSize: 3, lookbehind: 2, lookahead: 2 })

    expect(chunks[0]!.contextBefore).toHaveLength(0)
    expect(chunks[0]!.targetCues).toHaveLength(3)
    expect(chunks[0]!.contextAfter).toHaveLength(2)
  })

  it('middle chunk has both lookbehind and lookahead', () => {
    const doc = makeDoc(10)
    const chunks = buildChunks(doc, { chunkSize: 3, lookbehind: 2, lookahead: 2 })

    expect(chunks[1]!.contextBefore).toHaveLength(2)
    expect(chunks[1]!.targetCues).toHaveLength(3)
    expect(chunks[1]!.contextAfter).toHaveLength(2)
  })

  it('last chunk may have fewer target cues', () => {
    const doc = makeDoc(10)
    const chunks = buildChunks(doc, { chunkSize: 3, lookbehind: 1, lookahead: 1 })

    const last = chunks[chunks.length - 1]!
    expect(last.targetCues).toHaveLength(1) // 10 mod 3 = 1
    expect(last.contextAfter).toHaveLength(0)
  })

  it('each cue is a target exactly once', () => {
    const doc = makeDoc(15)
    const chunks = buildChunks(doc, { chunkSize: 5, lookbehind: 2, lookahead: 2 })

    const allTargetIds = chunks.flatMap((c) => c.targetCues.map((t) => t.sequence))
    expect(allTargetIds).toHaveLength(15)
    expect(new Set(allTargetIds).size).toBe(15)
  })

  it('single cue document produces one chunk', () => {
    const doc = makeDoc(1)
    const chunks = buildChunks(doc, { chunkSize: 15, lookbehind: 3, lookahead: 3 })

    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.targetCues).toHaveLength(1)
    expect(chunks[0]!.contextBefore).toHaveLength(0)
    expect(chunks[0]!.contextAfter).toHaveLength(0)
  })

  it('assigns sequential chunk IDs', () => {
    const doc = makeDoc(10)
    const chunks = buildChunks(doc, { chunkSize: 3, lookbehind: 1, lookahead: 1 })

    expect(chunks[0]!.chunkId).toBe('chunk_001')
    expect(chunks[1]!.chunkId).toBe('chunk_002')
  })
})

describe('Chunk Merger', () => {
  it('merges complete results correctly', () => {
    const doc = makeDoc(6)
    const chunks = buildChunks(doc, { chunkSize: 3, lookbehind: 1, lookahead: 1 })

    const results: ChunkTranslationResult[] = [
      {
        chunkId: 'chunk_001',
        items: [
          { id: 1, text: 'T1' },
          { id: 2, text: 'T2' },
          { id: 3, text: 'T3' },
        ],
        warnings: [],
        repairCount: 0,
      },
      {
        chunkId: 'chunk_002',
        items: [
          { id: 4, text: 'T4' },
          { id: 5, text: 'T5' },
          { id: 6, text: 'T6' },
        ],
        warnings: [],
        repairCount: 0,
      },
    ]

    const { translations, warnings } = mergeChunkResults(chunks, results, doc)
    expect(translations.size).toBe(6)
    expect(translations.get(1)).toBe('T1')
    expect(translations.get(6)).toBe('T6')
    expect(warnings).toHaveLength(0)
  })

  it('warns about missing translations', () => {
    const doc = makeDoc(3)
    const chunks = buildChunks(doc, { chunkSize: 3, lookbehind: 0, lookahead: 0 })

    const results: ChunkTranslationResult[] = [
      {
        chunkId: 'chunk_001',
        items: [
          { id: 1, text: 'T1' },
          // Missing id 2 and 3
        ],
        warnings: [],
        repairCount: 0,
      },
    ]

    const { warnings } = mergeChunkResults(chunks, results, doc)
    expect(warnings.some((w) => w.includes('Missing translation for cue 2'))).toBe(true)
    expect(warnings.some((w) => w.includes('Missing translation for cue 3'))).toBe(true)
  })
})
