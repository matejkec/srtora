import { describe, it, expect } from 'vitest'
import { normalizeContent } from '../parser/normalize.js'

describe('normalizeContent', () => {
  it('removes UTF-8 BOM', () => {
    const result = normalizeContent('\uFEFFHello')
    expect(result).toBe('Hello\n')
  })

  it('normalizes \\r\\n to \\n', () => {
    const result = normalizeContent('Line 1\r\nLine 2\r\n')
    expect(result).toBe('Line 1\nLine 2\n')
  })

  it('normalizes \\r to \\n', () => {
    const result = normalizeContent('Line 1\rLine 2\r')
    expect(result).toBe('Line 1\nLine 2\n')
  })

  it('trims trailing whitespace on each line', () => {
    const result = normalizeContent('Hello   \nWorld  \n')
    expect(result).toBe('Hello\nWorld\n')
  })

  it('ensures file ends with newline', () => {
    const result = normalizeContent('Hello')
    expect(result).toBe('Hello\n')
  })

  it('does not add extra newline if already present', () => {
    const result = normalizeContent('Hello\n')
    expect(result).toBe('Hello\n')
  })
})
