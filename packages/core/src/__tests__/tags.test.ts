import { describe, it, expect } from 'vitest'
import { extractTags, hasTags } from '../parser/tags.js'

describe('extractTags', () => {
  it('extracts bold tags', () => {
    const result = extractTags('<b>Hello</b>', 'srt')
    expect(result.plainText).toBe('Hello')
    expect(result.tags).toContain('<b>')
    expect(result.tags).toContain('</b>')
  })

  it('extracts italic tags', () => {
    const result = extractTags('<i>italic</i>', 'srt')
    expect(result.plainText).toBe('italic')
    expect(result.tags).toContain('<i>')
  })

  it('extracts font color tags', () => {
    const result = extractTags('<font color="#ff0000">Red</font>', 'srt')
    expect(result.plainText).toBe('Red')
    expect(result.tags).toContain('<font color="#ff0000">')
  })

  it('handles nested tags', () => {
    const result = extractTags('<b><i>Both</i></b>', 'srt')
    expect(result.plainText).toBe('Both')
    expect(result.tags).toHaveLength(4)
  })

  it('handles text without tags', () => {
    const result = extractTags('Plain text', 'srt')
    expect(result.plainText).toBe('Plain text')
    expect(result.tags).toHaveLength(0)
  })

  it('handles VTT voice tags', () => {
    const result = extractTags('<v Speaker1>Hello there.</v>', 'vtt')
    expect(result.plainText).toBe('Hello there.')
    expect(result.tags).toContain('<v Speaker1>')
  })

  it('handles VTT class tags', () => {
    const result = extractTags('<c.highlight>Text</c>', 'vtt')
    expect(result.plainText).toBe('Text')
    expect(result.tags).toContain('<c.highlight>')
  })
})

describe('hasTags', () => {
  it('returns true for text with tags', () => {
    expect(hasTags('<b>Bold</b>')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(hasTags('No tags here')).toBe(false)
  })
})
