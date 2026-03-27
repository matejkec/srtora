import { describe, it, expect } from 'vitest'
import { repairJson, parseJsonSafe } from '../json-repair.js'

describe('repairJson', () => {
  it('strips markdown code fences', () => {
    const input = '```json\n{"a": 1}\n```'
    expect(repairJson(input)).toBe('{"a": 1}')
  })

  it('strips code fences without language tag', () => {
    const input = '```\n[1,2,3]\n```'
    expect(repairJson(input)).toBe('[1,2,3]')
  })

  it('removes trailing commas before closing brackets', () => {
    const input = '{"items": [1, 2, 3,]}'
    expect(JSON.parse(repairJson(input))).toEqual({ items: [1, 2, 3] })
  })

  it('closes unclosed brackets at the end of input', () => {
    // The repair logic closes unclosed brackets using a stack
    // When inner objects are complete, it adds missing outer closers
    const input = '{"name": "test", "items": [1, 2, 3'
    const repaired = repairJson(input)
    const parsed = JSON.parse(repaired)
    expect(parsed.name).toBe('test')
    expect(parsed.items).toEqual([1, 2, 3])
  })

  it('closes unclosed objects', () => {
    const input = '{"translations": [{"id": 1, "text": "test"}'
    const repaired = repairJson(input)
    const parsed = JSON.parse(repaired)
    expect(parsed.translations).toHaveLength(1)
  })

  it('extracts JSON from prose', () => {
    const input = 'Here is the translation:\n{"translations": [{"id": 1, "text": "test"}]}\nDone!'
    const repaired = repairJson(input)
    const parsed = JSON.parse(repaired)
    expect(parsed.translations).toBeDefined()
  })

  it('handles already valid JSON', () => {
    const input = '{"a": 1}'
    expect(repairJson(input)).toBe('{"a": 1}')
  })

  it('escapes raw newlines inside JSON string values', () => {
    // LLMs sometimes output raw newlines instead of \n escapes inside strings
    const input = '{"id": 1, "text": "line one\nline two"}'
    const repaired = repairJson(input)
    const parsed = JSON.parse(repaired)
    expect(parsed.text).toBe('line one\nline two')
  })

  it('preserves already-escaped newlines', () => {
    const input = '{"id": 1, "text": "line one\\nline two"}'
    const repaired = repairJson(input)
    const parsed = JSON.parse(repaired)
    expect(parsed.text).toBe('line one\nline two')
  })

  it('handles mixed raw and escaped newlines in same response', () => {
    // Simulates LLM being inconsistent (some \\n, some raw \n)
    const input = '{"translations": [{"id": 1, "text": "a\\nb"}, {"id": 2, "text": "c\nd"}]}'
    const repaired = repairJson(input)
    const parsed = JSON.parse(repaired)
    expect(parsed.translations[0].text).toBe('a\nb')
    expect(parsed.translations[1].text).toBe('c\nd')
  })

  it('handles markdown fences with raw newlines inside strings', () => {
    const input = '```json\n{"translations": [{"id": 37, "text": "<i>Imam odgojeno.\nImam najbolje.</i>"}]}\n```'
    const repaired = repairJson(input)
    const parsed = JSON.parse(repaired)
    expect(parsed.translations[0].text).toBe('<i>Imam odgojeno.\nImam najbolje.</i>')
  })

  it('escapes invalid backslash sequences in strings', () => {
    // Subtitle tags like {\an8} have \a which is invalid in JSON
    const input = String.raw`{"id": 9, "text": "{\an8}[presenter] Test"}`
    const repaired = repairJson(input)
    const parsed = JSON.parse(repaired)
    expect(parsed.text).toBe('{\\an8}[presenter] Test')
  })

  it('preserves valid escape sequences while fixing invalid ones', () => {
    const input = String.raw`{"text": "line1\nline2 {\an8} and \"quoted\""}`
    const repaired = repairJson(input)
    const parsed = JSON.parse(repaired)
    expect(parsed.text).toContain('line1\nline2')
    expect(parsed.text).toContain('\\an8')
    expect(parsed.text).toContain('"quoted"')
  })
})

describe('parseJsonSafe', () => {
  it('parses valid JSON without repair', () => {
    const result = parseJsonSafe('{"a": 1}')
    expect(result).not.toBeNull()
    expect(result!.data).toEqual({ a: 1 })
    expect(result!.repaired).toBe(false)
  })

  it('repairs and parses markdown-wrapped JSON', () => {
    const result = parseJsonSafe('```json\n{"a": 1}\n```')
    expect(result).not.toBeNull()
    expect(result!.data).toEqual({ a: 1 })
    expect(result!.repaired).toBe(true)
  })

  it('returns null for completely invalid input', () => {
    expect(parseJsonSafe('this is not json at all')).toBeNull()
  })

  it('falls back to regex extraction for unescaped quotes in strings', () => {
    // LLM puts unescaped quotes in values: "["Your Cheating Heart" plays]"
    const input = '{"translations": [{"id": 1, "text": "test"}, {"id": 2, "text": "["Song Title" plays]"}]}'
    const result = parseJsonSafe<{ translations: Array<{ id: number; text: string }> }>(input)
    expect(result).not.toBeNull()
    expect(result!.repaired).toBe(true)
    expect(result!.data.translations.length).toBeGreaterThanOrEqual(1)
    // id 2 should be recovered via regex
    const item2 = result!.data.translations.find(i => i.id === 2)
    expect(item2).toBeDefined()
    expect(item2!.text).toContain('Song Title')
  })

  it('parses arrays directly', () => {
    const result = parseJsonSafe('[1, 2, 3]')
    expect(result).not.toBeNull()
    expect(result!.data).toEqual([1, 2, 3])
    expect(result!.repaired).toBe(false)
  })
})
