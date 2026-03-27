import type { SubtitleFormat } from '@srtora/types'

/** Result of extracting tags from cue text */
export interface TagExtractionResult {
  /** Text with all formatting tags removed */
  plainText: string
  /** List of unique tags found */
  tags: string[]
}

/**
 * Regex to match common formatting tags in subtitle text.
 * Covers: <b>, </b>, <i>, </i>, <u>, </u>, <font ...>, </font>,
 *   <c...>, </c>, <v ...>, </v>, <lang ...>, </lang>, <ruby>, </ruby>, <rt>, </rt>
 * VTT class annotations: <c.classname>, <b.classname>
 * VTT voice annotations: <v Name>
 */
const TAG_REGEX = /<\/?(?:b|i|u|font|c|v|lang|ruby|rt)(?:[.\s][^>]*)?\s*>/gi

/**
 * Extracts inline formatting tags from cue text and returns plain text.
 */
export function extractTags(text: string, _format: SubtitleFormat): TagExtractionResult {
  const tags: string[] = []
  const regex = new RegExp(TAG_REGEX.source, TAG_REGEX.flags)
  const matches = text.matchAll(regex)
  for (const match of matches) {
    const tag = match[0]
    if (!tags.includes(tag)) {
      tags.push(tag)
    }
  }

  const plainText = text.replace(new RegExp(TAG_REGEX.source, TAG_REGEX.flags), '').trim()

  return { plainText, tags }
}

/**
 * Checks whether a text contains formatting tags.
 */
export function hasTags(text: string): boolean {
  return new RegExp(TAG_REGEX.source, TAG_REGEX.flags).test(text)
}
