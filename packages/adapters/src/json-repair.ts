/** Valid JSON escape characters after a backslash */
const VALID_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'])

/**
 * Fix control characters and invalid escape sequences inside JSON string values.
 *
 * LLMs produce two common issues inside JSON strings:
 * 1. Raw newlines/tabs instead of \n / \t escape sequences
 * 2. Invalid escape sequences like \a from subtitle tags (e.g. {\an8}) —
 *    these need the backslash doubled to \\
 *
 * Structural characters outside strings are left untouched.
 */
function sanitizeJsonStrings(text: string): string {
  let result = ''
  let inString = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!

    if (!inString) {
      if (ch === '"') inString = true
      result += ch
      continue
    }

    // Inside a string
    if (ch === '"') {
      // End of string
      inString = false
      result += ch
      continue
    }

    if (ch === '\\') {
      const next = text[i + 1]
      if (next === undefined) {
        // Trailing backslash at end of input — escape it
        result += '\\\\'
        continue
      }
      if (next === 'u') {
        // \uXXXX — pass through (valid unicode escape)
        result += ch
        continue
      }
      if (VALID_ESCAPES.has(next)) {
        // Valid escape sequence — pass through both chars
        result += ch + next
        i++
        continue
      }
      // Invalid escape like \a, \g, etc. — double the backslash
      result += '\\\\'
      continue
    }

    // Raw control characters inside string
    if (ch === '\n') {
      result += '\\n'
      continue
    }
    if (ch === '\r') {
      continue // skip CR
    }
    if (ch === '\t') {
      result += '\\t'
      continue
    }

    result += ch
  }

  return result
}

/**
 * Attempts to repair malformed JSON from LLM output.
 * Handles common issues: markdown fences, trailing commas, missing brackets,
 * raw newlines inside strings, partial output.
 */
export function repairJson(raw: string): string {
  let text = raw.trim()

  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
  text = text.trim()

  // If the response is wrapped in prose, try to extract JSON
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  if (jsonMatch) {
    text = jsonMatch[1]!
  }

  // Remove trailing commas before closing brackets
  text = text.replace(/,(\s*[}\]])/g, '$1')

  // Sanitize invalid escape sequences and raw control characters inside strings
  text = sanitizeJsonStrings(text)

  // Try to fix unclosed arrays/objects
  const opens = (text.match(/[{[]/g) || []).length
  const closes = (text.match(/[}\]]/g) || []).length

  if (opens > closes) {
    const stack: string[] = []
    let inString = false
    let escape = false

    for (const ch of text) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\' && inString) {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue

      if (ch === '{' || ch === '[') stack.push(ch)
      if (ch === '}' || ch === ']') stack.pop()
    }

    while (stack.length > 0) {
      const open = stack.pop()!
      text = text.replace(/,\s*$/, '')
      text += open === '{' ? '}' : ']'
    }
  }

  return text
}

/**
 * Parse JSON with repair attempt on failure.
 * Falls back to regex extraction if structural repair is not enough.
 */
export function parseJsonSafe<T = unknown>(raw: string): { data: T; repaired: boolean } | null {
  try {
    return { data: JSON.parse(raw) as T, repaired: false }
  } catch {
    try {
      const repaired = repairJson(raw)
      return { data: JSON.parse(repaired) as T, repaired: true }
    } catch {
      // Last resort: try extracting translation items via regex.
      // This handles cases where the LLM puts unescaped quotes inside strings
      // (e.g. "text": "["Your Cheating Heart" svira]")
      const extracted = extractTranslationItems(raw)
      if (extracted) {
        return { data: extracted as T, repaired: true }
      }
      return null
    }
  }
}

/**
 * Regex-based extraction of translation items from malformed JSON.
 * Handles cases where the LLM puts unescaped quotes or other invalid
 * content inside string values.
 *
 * Strategy: match `"id": N` then grab everything from the first `"` after
 * `"text":` up to the closing `"}` that is followed by `,` or `]` or end.
 */
function extractTranslationItems(raw: string): { translations: Array<{ id: number; text: string }> } | null {
  if (!raw.includes('"id"') || !raw.includes('"text"')) return null

  const items: Array<{ id: number; text: string }> = []

  // Split the raw text at item boundaries: `}, {` or `},{`
  // This works because each item is an object in an array
  const itemPattern = /\{\s*"id"\s*:\s*(\d+)\s*,\s*"text"\s*:\s*"([\s\S]*?)"\s*\}(?=\s*[,\]\}]|\s*`|\s*$)/g
  let match

  while ((match = itemPattern.exec(raw)) !== null) {
    const id = parseInt(match[1]!, 10)
    let text = match[2]!
    // The lazy match may have stopped too early if there are unescaped quotes.
    // We don't try to fix that here — we just take what we can get.
    text = text.replace(/\n/g, '\\n').replace(/\r/g, '')
    items.push({ id, text })
  }

  // If the regex approach got too few items, try a more aggressive line-based extraction
  if (items.length === 0) {
    // Find all "id": N patterns and extract the subsequent text value
    const linePattern = /"id"\s*:\s*(\d+)\s*,\s*"text"\s*:\s*/g
    let lineMatch
    while ((lineMatch = linePattern.exec(raw)) !== null) {
      const id = parseInt(lineMatch[1]!, 10)
      const afterText = raw.substring(lineMatch.index + lineMatch[0].length)

      // The text value starts with " and we need to find the matching closing "
      // that is followed by } (end of item)
      if (afterText[0] !== '"') continue
      // Find the `"}` pattern that ends this item
      const endMatch = afterText.match(/"}\s*[,\]\}]|"}\s*$/)
      if (!endMatch || endMatch.index === undefined) continue

      let text = afterText.substring(1, endMatch.index)
      text = text.replace(/\n/g, '\\n').replace(/\r/g, '')
      items.push({ id, text })
    }
  }

  if (items.length === 0) return null
  return { translations: items }
}
