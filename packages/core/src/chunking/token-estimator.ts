/**
 * Language-aware token estimation for subtitle content.
 *
 * Uses empirical chars-per-token ratios by language family.
 * These ratios are approximate — precision is not needed for chunk sizing,
 * only reasonable ballpark estimates.
 */

/** Chars-per-token by language/language family */
const CHARS_PER_TOKEN: Record<string, number> = {
  // CJK — dense scripts, few chars per token
  zh: 1.5,
  ja: 1.5,
  // Korean — slightly more chars per token than CJK
  ko: 2,
  // Arabic/Hebrew — compact scripts
  ar: 3,
  he: 3,
  // Slavic — longer average words
  hr: 3.5,
  sr: 3.5,
  cs: 3.5,
  pl: 3.5,
  ru: 3.5,
  uk: 3.5,
  sl: 3.5,
  sk: 3.5,
  bs: 3.5,
  bg: 3.5,
  // Latin/Germanic/Romance — typical tokenizer efficiency
  en: 4,
  de: 4,
  fr: 4,
  es: 4,
  it: 4,
  pt: 4,
  nl: 4,
  sv: 4,
  da: 4,
  no: 4,
  fi: 4,
  // Thai/Vietnamese — mixed
  th: 2,
  vi: 3.5,
  // Turkish/Hungarian — agglutinative, longer words
  tr: 3.5,
  hu: 3.5,
}

const DEFAULT_CHARS_PER_TOKEN = 4

/**
 * Get the chars-per-token ratio for a language.
 * Falls back to 4 (typical for Latin/English) for unknown languages.
 */
export function getCharsPerToken(language: string): number {
  // Normalize: take first 2 chars, lowercase (handles "en-US" → "en")
  const code = language.toLowerCase().slice(0, 2)
  return CHARS_PER_TOKEN[code] ?? DEFAULT_CHARS_PER_TOKEN
}

/**
 * Estimate the token count for a text string in a given language.
 */
export function estimateTokens(text: string, language: string): number {
  const cpt = getCharsPerToken(language)
  return Math.max(1, Math.ceil(text.length / cpt))
}
